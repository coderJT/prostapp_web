import json
from collections import OrderedDict
import logging
import os
import time
from functools import lru_cache
from io import StringIO
from pathlib import Path
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
import shap
from groq import Groq
from lime.lime_tabular import LimeTabularExplainer

# ---------------------------------------------------------------------------
# MLflow integration (optional – gracefully degrades if not installed/configured)
# ---------------------------------------------------------------------------
try:
    import mlflow
    import mlflow.sklearn
    from mlflow_config import (
        EXPERIMENT_PREDICTIONS,
        MODEL_INVASIVE,
        MODEL_NON_INVASIVE,
        PRODUCTION_ALIAS,
        configure_mlflow,
    )
    configure_mlflow()
    _MLFLOW_AVAILABLE = True
except Exception:
    _MLFLOW_AVAILABLE = False

log = logging.getLogger(__name__)

# Root paths
ROOT_DIR = Path(__file__).resolve().parents[3]
INVASIVE_MODEL_PATH = ROOT_DIR / "ML" / "models" / "lgbm_clinical.joblib"
FTIR_XGB_MODEL_PATH = ROOT_DIR / "ML" / "models" / "xgb_FTIR.joblib"
FTIR_LGBM_MODEL_PATH = ROOT_DIR / "ML" / "models" / "lgbm_FTIR.joblib"
PCA_OBJECTS_PATH = ROOT_DIR / "ML" / "models" / "sector_pca_objects_xgb_FTIR.joblib"
INVASIVE_BACKGROUND_CSV = ROOT_DIR / "data" / "test" / "test_invasive_data.csv"

# Column definitions (invasive)
INVASIVE_COLUMNS = [
    "age",
    "psa_(ng/ml)",
    "body_weight_(kg)",
    "height_(cm)",
    "family_history_prostate_cancer",
    "educational_background",
    "hypertension",
    "heart_disease",
    "cerebro_vascular_disease",
    "hyperlipidemia",
    "diabetes_melitus",
    "renal_disease",
    "other_cancer",
    "other_disease",
    "region_Rural",
    "race_C",
    "race_I",
    "race_M",
]

COMORBIDITY_FEATURES = {
    "hypertension": "hypertension history",
    "heart_disease": "heart disease history",
    "cerebro_vascular_disease": "cerebrovascular disease history",
    "hyperlipidemia": "hyperlipidemia history",
    "diabetes_melitus": "diabetes mellitus history",
    "renal_disease": "renal disease history",
    "other_cancer": "other cancer history",
    "other_disease": "other disease history",
}


def _format_number(value, decimals: int = 3) -> str:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return "N/A"

    if numeric.is_integer():
        return str(int(numeric))
    return f"{numeric:.{decimals}f}".rstrip("0").rstrip(".")


def _format_yes_no(value) -> str:
    try:
        return "Yes" if float(value) >= 0.5 else "No"
    except (TypeError, ValueError):
        return "N/A"


def _feature_direction(weight: Optional[float]) -> str:
    if weight is None:
        return ""
    if weight > 0:
        return " In this explanation, it pushed the model toward the higher-risk class."
    if weight < 0:
        return " In this explanation, it pushed the model toward the lower-risk class."
    return ""


def _clinical_feature_note(feature: str, value, weight: Optional[float] = None) -> Dict:
    direction = _feature_direction(weight)
    binary_features = {
        "family_history_prostate_cancer": (
            "Family history of prostate cancer",
            None,
            "Family history can raise baseline prostate cancer risk, especially for first-degree relatives or early-onset disease.",
        ),
        "race_C": (
            "Race indicator: Chinese",
            "Chinese",
            "Race/ethnicity is a protected demographic input, not a biological explanation. The project notebook flagged race imbalance and subgroup fairness disparities, so treat this as a potential bias signal rather than a clinical reason.",
        ),
        "race_I": (
            "Race indicator: Indian",
            "Indian",
            "Race/ethnicity is a protected demographic input, not a biological explanation. The project notebook flagged race imbalance and subgroup fairness disparities, so treat this as a potential bias signal rather than a clinical reason.",
        ),
        "race_M": (
            "Race indicator: Malay",
            "Malay",
            "Race/ethnicity is a protected demographic input, not a biological explanation. The project notebook flagged race imbalance and subgroup fairness disparities, so treat this as a potential bias signal rather than a clinical reason.",
        ),
    }

    if feature == "age":
        return {
            "display_feature": "Age",
            "display_value": f"{_format_number(value, 0)} years",
            "meaning": f"Age is a background risk factor and should be interpreted with PSA trend, symptoms, exam findings, and overall health.{direction}",
        }
    if feature == "psa_(ng/ml)":
        return {
            "display_feature": "PSA level",
            "display_value": f"{_format_number(value, 2)} ng/mL",
            "meaning": f"PSA is a prostate blood marker; elevated values can occur with cancer, benign enlargement, infection, inflammation, or recent procedures.{direction}",
        }
    if feature == "body_weight_(kg)":
        return {
            "display_feature": "Body weight",
            "display_value": f"{_format_number(value, 1)} kg",
            "meaning": f"Body size is a model context variable here, not a standalone prostate cancer decision factor.{direction}",
        }
    if feature == "height_(cm)":
        return {
            "display_feature": "Height",
            "display_value": f"{_format_number(value, 1)} cm",
            "meaning": f"Body size is a model context variable here, not a standalone prostate cancer decision factor.{direction}",
        }
    if feature == "educational_background":
        labels = {
            0: "No formal / primary",
            1: "Secondary",
            2: "Tertiary",
            3: "Postgraduate",
        }
        try:
            display_value = labels.get(round(float(value)), f"Code {_format_number(value, 0)}")
        except (TypeError, ValueError):
            display_value = "N/A"
        return {
            "display_feature": "Education background",
            "display_value": display_value,
            "meaning": f"Education is a contextual dataset variable and should not be treated as a direct biological risk factor. It can also behave as a social-context proxy, so interpret any influence as a dataset-pattern signal rather than a clinical reason.{direction}",
        }
    if feature == "region_Rural":
        return {
            "display_feature": "Region",
            "display_value": "Rural" if float(value) >= 0.5 else "Urban / not rural",
            "meaning": f"Region is a care-context and access variable in the dataset; it is not a biological explanation and may capture access-to-care or sampling patterns.{direction}",
        }
    if feature in binary_features:
        display_feature, race_label, meaning = binary_features[feature]
        display_value = f"{race_label}: {'yes' if float(value) >= 0.5 else 'no'}" if race_label else _format_yes_no(value)
        return {
            "display_feature": display_feature,
            "display_value": display_value,
            "meaning": f"{meaning}{direction}",
        }
    if feature in COMORBIDITY_FEATURES:
        label = COMORBIDITY_FEATURES[feature].replace("_", " ").title()
        if feature == "diabetes_melitus":
            meaning = "This records diabetes mellitus history. Clinically it is comorbidity context, not a direct prostate cancer finding. The project notebook also noted diabetes may act as a weak race proxy in this dataset."
        else:
            meaning = f"This records {COMORBIDITY_FEATURES[feature]}. It may reflect background health status or care pathway context, not a direct causal finding."
        return {
            "display_feature": label,
            "display_value": _format_yes_no(value),
            "meaning": f"{meaning}{direction}",
        }
    if feature.startswith("Column_"):
        return {
            "display_feature": f"FTIR PCA component {feature.replace('Column_', '')}",
            "display_value": f"PCA score {_format_number(value, 4)}",
            "meaning": f"This is a PCA component derived from a defined FTIR wavenumber region. Interpret it with neighboring components as regional biochemical context, not as a standalone biomarker or clinical measurement.{direction}",
        }

    return {
        "display_value": _format_number(value, 4),
        "meaning": f"Patient-specific LIME contribution.{direction}",
    }


def _component_feature_notes(df: pd.DataFrame, lime_features: List[Dict]) -> List[Dict]:
    """Return one display note per PCA component, with LIME weight when available."""
    lime_by_feature = {item["feature"]: item for item in lime_features}
    notes = []
    for feature in df.columns:
        if not str(feature).startswith("Column_"):
            continue
        value = float(df.iloc[0][feature])
        lime_item = lime_by_feature.get(feature)
        weight = float(lime_item["weight"]) if lime_item else None
        note = {
            "feature": feature,
            "value": value,
            **_clinical_feature_note(str(feature), value, weight),
        }
        if weight is not None:
            note["weight"] = weight
        notes.append(note)
    return notes

# Sector-wise PCA definitions for FTIR wavenumber data
# Each sector slices wavenumber columns from high (inclusive) to low (exclusive)
SECTOR_RANGES = OrderedDict([
    ('3500-3000', (3500, 3000)),
    ('3000-2800', (3000, 2800)),
    ('1740-1720', (1740, 1720)),
    ('1700-1470', (1700, 1470)),
    ('1470-1200', (1470, 1200)),
    ('1200-1000', (1200, 1000)),
    ('1000-700',  (1000, 700)),
    ('700-400',   (700, 400)),
])

# Metadata columns to strip from uploaded FTIR CSVs
FTIR_METADATA_COLUMNS = {'id', 'created_at', 'patient_name', 'result'}

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
SYSTEM_PROMPT = (
    "You are a senior urologist and prostate-cancer clinical decision-support expert working "
    "with a clinical data scientist. Explain SHAP/LIME outputs in careful plain language for "
    "a clinician-facing research dashboard. Do not diagnose, prescribe, imply the model output "
    "is definitive, invent unsupported treatment reasons, or turn model "
    "associations into causal medical explanations. Keep uncertainty explicit and tie every "
    "statement to the supplied feature values and model direction."
)

PROSTATE_DOMAIN_GUIDANCE = "\n".join([
    "Clinical interpretation guidance:",
    "- PSA is prostate-specific antigen. Higher PSA can be associated with prostate cancer, benign prostatic enlargement, prostatitis, urinary infection, recent instrumentation, or ejaculation; interpret with age, prostate volume, exam findings, repeat testing, and clinical context.",
    "- Age is a major prostate-cancer risk factor, but age alone does not determine whether invasive assessment is appropriate; fitness, life expectancy, symptoms, PSA kinetics, MRI findings, and patient preference matter.",
    "- Family history increases baseline risk, especially in first-degree relatives or early-onset disease.",
    "- Race/ethnicity variables are protected demographic model inputs, not biological explanations. This project notebook includes bias evaluation data: race distribution imbalance, subgroup performance disparities, and possible proxy variables were flagged. When race or proxy variables appear, describe them as fairness-risk signals requiring audit, not clinical reasons.",
    "- Diabetes, education, and region may behave as weak race or access-to-care proxies in this dataset. Explain that possibility when those variables influence a result.",
    "- Diabetes, hyperlipidemia, hypertension, renal disease, cardiovascular disease, and body size are comorbidity/context variables. Discuss them as possible correlates of pathway selection or background health status, not direct causes.",
    "- Height and weight rarely have direct clinical meaning for prostate biopsy decisions; if they appear important, frame them as model-learned associations needing clinical review.",
    "- For invasive-modality predictions, class 1 means the model leans toward invasive modality being necessary or higher modeled need; class 0 means lower modeled need.",
    "- For FTIR/non-invasive predictions, spectral/PCA components should be grouped back to their source wavenumber regions. Explain the region-level biomolecular context, not individual columns as biomarkers.",
    "- The FTIR workflow uses urinary extracellular vesicles (uEVs). EV cargo can differ between normal and cancer-derived cells, and FTIR measures mid-infrared absorbance patterns from biochemical bonds rather than PSA-like single lab values.",
    "- For FTIR spectra, explain common regions in plain language: 3500-3000 cm-1 proteins/water hydration, 3000-2800 cm-1 lipid C-H stretching, 1740-1720 cm-1 lipid carbonyl, 1700-1470 cm-1 protein Amide I/II, 1470-1200 cm-1 protein/lipid deformation and Amide III, 1200-1000 and 1000-700 cm-1 carbohydrates/nucleic acids/phosphate, 700-400 cm-1 phosphates/lipid skeletal vibrations.",
    "- If the FTIR model reports PCA components, say that the model compressed thousands of wavenumber readings into sector PCA components, so the safest explanation is region-level spectral pattern evidence: hydration/protein, lipid, Amide I/II protein structure, carbohydrate/nucleic-acid, phosphate, and lipid-skeleton patterns.",
    "- Positive LIME/SHAP direction pushes toward class 1; negative direction pushes toward class 0. Magnitude reflects model influence, not clinical severity.",
])

OUTPUT_RULES = "\n".join([
    "Return plain text with these sections:",
    "Patient takeaway",
    "Write 2-3 short sentences a patient can understand. Include probability/class, whether this is lower/intermediate/higher modeled concern, and what the result does and does not mean.",
    "",
    "What influenced the result",
    "Use up to 5 bullets prefixed with '- '. For each bullet, write: feature label, patient value if available, model direction/weight, plain clinical meaning, and caution if the feature is demographic, comorbidity, or PCA/spectral.",
    "",
    "FTIR interpretation",
    "If modality is FTIR/non-invasive, explain urinary EV FTIR in 2-3 sentences: the model looks at spectral patterns related to proteins, lipids, carbohydrates/nucleic acids, phosphates, and hydration; PCA components are compressed spectral patterns, not named diagnoses. If modality is invasive/clinical, write 'Not applicable for this clinical-data report.'",
    "",
    "Suggested next context",
    "Use 2 bullets prefixed with '- '. Mention the specific clinical context that would help interpretation, such as PSA trend, DRE, MRI, biopsy history, urinary symptoms/infection, prostate volume, family history, and clinician review.",
    "",
    "Clinical caution",
    "Write 1 short sentence that this is decision support and not a diagnosis.",
])

LANGUAGE_INSTRUCTIONS = {
    "en": "Write the entire explanation in English.",
    "ms": "Write the entire explanation in Bahasa Malaysia. Keep medical abbreviations such as PSA, DRE, MRI, LIME, and SHAP in their standard form, with clear Bahasa Malaysia wording around them.",
    "zh": "Write the entire explanation in Chinese. Keep medical abbreviations such as PSA, DRE, MRI, LIME, and SHAP in their standard form, with clear Chinese wording around them.",
}


def _language_instruction(language: str) -> str:
    return LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])


# ---------- PCA loading / transformation ----------
@lru_cache(maxsize=1)
def load_pca_objects():
    """Load the pre-trained sector PCA objects dictionary."""
    return joblib.load(PCA_OBJECTS_PATH)


def apply_sector_pca(raw_df: pd.DataFrame) -> pd.DataFrame:
    """Transform raw FTIR wavenumber data (>=2020 columns) into 103 PCA components."""
    pca_objects = load_pca_objects()
    components = []

    for sector_name, (high, low) in SECTOR_RANGES.items():
        # Select wavenumber columns: high, high-1, ..., low+1
        sector_cols = [str(w) for w in range(high, low, -1)]
        missing = [c for c in sector_cols if c not in raw_df.columns]
        if missing:
            raise ValueError(
                f"Missing {len(missing)} wavenumber columns for sector {sector_name}. "
                f"Expected columns {high} down to {low + 1}."
            )
        sector_data = raw_df[sector_cols].astype(float).values
        pca = pca_objects[sector_name]
        transformed = pca.transform(sector_data)
        components.append(transformed)

    all_components = np.hstack(components)
    col_names = [f"Column_{i}" for i in range(all_components.shape[1])]
    return pd.DataFrame(all_components, columns=col_names, index=raw_df.index)


# ---------- Model loading ----------
def _load_from_mlflow(modality: str):
    """Try to load the model from the MLflow Model Registry."""
    if not _MLFLOW_AVAILABLE:
        return None
    registry_name = MODEL_INVASIVE if modality == "invasive" else MODEL_NON_INVASIVE
    model_uri = f"models:/{registry_name}@{PRODUCTION_ALIAS}"
    try:
        model = mlflow.sklearn.load_model(model_uri)
        log.info("Loaded %s from MLflow registry (%s)", modality, model_uri)
        return model
    except Exception as exc:
        log.warning("MLflow load failed for %s: %s – falling back to joblib", modality, exc)
        return None


@lru_cache(maxsize=4)
def load_model(modality: str, model_type: str = "xgb"):
    if modality == "invasive":
        # Prefer MLflow registry; fall back to local joblib.
        model = _load_from_mlflow(modality)
        if model is not None:
            return model
        return joblib.load(INVASIVE_MODEL_PATH)
    if modality == "non-invasive":
        # The registry currently stores the XGBoost FTIR champion only.
        # Keep explicit LightGBM selections tied to the local LightGBM artifact.
        if model_type != "lgbm":
            model = _load_from_mlflow(modality)
            if model is not None:
                return model
        path = FTIR_LGBM_MODEL_PATH if model_type == "lgbm" else FTIR_XGB_MODEL_PATH
        return joblib.load(path)
    raise ValueError(f"Unsupported modality '{modality}'. Use 'invasive' or 'non-invasive'.")


# ---------- CSV parsing ----------
def parse_csv(modality: str, csv_text: str) -> pd.DataFrame:
    df = pd.read_csv(StringIO(csv_text))
    if df.empty:
        raise ValueError("The input CSV file is empty.")

    if modality == "invasive":
        if len(df) != 1:
            raise ValueError("Invasive CSV must contain exactly one row.")
        if list(df.columns) != INVASIVE_COLUMNS:
            raise ValueError(f"Invasive CSV must contain columns: {INVASIVE_COLUMNS}")
    else:
        if len(df) != 1:
            raise ValueError("Non-invasive CSV must contain exactly one row.")
        # Strip metadata columns before PCA
        df = df.drop(
            columns=[c for c in FTIR_METADATA_COLUMNS if c in df.columns],
            errors="ignore",
        )
        # Apply sector-wise PCA to compress raw wavenumber data -> 103 features
        df = apply_sector_pca(df)

    return df


# ---------- Probability helper ----------
def _build_probability_fn(model, columns: Optional[List[str]] = None):
    feature_names = columns or list(getattr(model, "feature_names_in_", []))

    def probability_fn(array_2d):
        if feature_names:
            array_input = pd.DataFrame(array_2d, columns=feature_names)
        else:
            array_input = array_2d

        if hasattr(model, "predict_proba"):
            probs = np.asarray(model.predict_proba(array_input))
            if probs.ndim == 1:
                return np.column_stack([1 - probs, probs])
            if probs.shape[1] == 1:
                class_1 = probs[:, 0]
                return np.column_stack([1 - class_1, class_1])
            return probs

        preds = np.asarray(model.predict(array_input), dtype=float)
        preds = np.clip(preds, 0, 1)
        return np.column_stack([1 - preds, preds])

    return probability_fn


# ---------- LIME ----------
def _load_invasive_background(single_row_df: pd.DataFrame) -> pd.DataFrame:
    if INVASIVE_BACKGROUND_CSV.exists():
        background_df = pd.read_csv(INVASIVE_BACKGROUND_CSV)
        if list(background_df.columns) == INVASIVE_COLUMNS and not background_df.empty:
            background_df = background_df.apply(pd.to_numeric, errors="coerce").dropna()
            if len(background_df) >= 20:
                return background_df

    rng = np.random.default_rng(42)
    instance = single_row_df.iloc[0]
    repeated = pd.DataFrame([instance.values] * 500, columns=single_row_df.columns)
    noise_scale = np.maximum(np.abs(repeated.values) * 0.05, 1e-6)
    noisy = repeated.values + rng.normal(0.0, noise_scale)
    return pd.DataFrame(noisy, columns=single_row_df.columns)


def _build_lime_background(modality: str, single_row_df: pd.DataFrame) -> pd.DataFrame:
    if modality == "invasive":
        return _load_invasive_background(single_row_df)
    rng = np.random.default_rng(42)
    repeated = pd.DataFrame([single_row_df.iloc[0].values] * 200, columns=single_row_df.columns)
    noise_scale = np.maximum(np.abs(repeated.values) * 0.05, 1e-6)
    noisy = repeated.values + rng.normal(0.0, noise_scale)
    return pd.DataFrame(noisy, columns=single_row_df.columns)


def build_lime(modality: str, model, single_row_df: pd.DataFrame, predicted_class: int) -> List[Dict]:
    columns = INVASIVE_COLUMNS if modality == "invasive" else list(single_row_df.columns)
    probability_fn = _build_probability_fn(model, columns)
    background_df = _build_lime_background(modality, single_row_df)

    explainer = LimeTabularExplainer(
        training_data=background_df.values,
        feature_names=columns,
        class_names=["0", "1"],
        mode="classification",
        discretize_continuous=True,
        random_state=42,
    )

    explanation = explainer.explain_instance(
        data_row=single_row_df.iloc[0].values,
        predict_fn=probability_fn,
        num_features=min(10, len(columns)),
        num_samples=1000,
    )

    lime_map_dict = dict(explanation.local_exp) if explanation.local_exp else explanation.as_map()
    target_class = predicted_class
    if target_class not in lime_map_dict and lime_map_dict:
        target_class = max(lime_map_dict.keys(), key=lambda key: len(lime_map_dict[key]))

    lime_map = lime_map_dict.get(target_class, [])
    weighted_features = []
    for feature_index, weight in lime_map:
        weighted_features.append(
            {
                "feature": columns[feature_index],
                "feature_index": int(feature_index),
                "feature_value": float(single_row_df.iloc[0, feature_index]),
                "weight": float(weight),
            }
        )

    weighted_features.sort(key=lambda item: abs(item["weight"]), reverse=True)
    return weighted_features


# ---------- SHAP ----------
def _extract_shap_matrix(raw_shap_values):
    if isinstance(raw_shap_values, list):
        if len(raw_shap_values) == 1:
            return np.asarray(raw_shap_values[0])
        return np.asarray(raw_shap_values[-1])

    shap_array = np.asarray(raw_shap_values)
    if shap_array.ndim == 3:
        return shap_array[:, :, -1]
    if shap_array.ndim == 2:
        return shap_array

    raise ValueError("Unsupported SHAP output shape.")


def build_shap(modality: str, model, df: pd.DataFrame) -> List[Dict]:
    explainer = shap.TreeExplainer(model)
    raw_shap_values = explainer.shap_values(df)
    shap_matrix = _extract_shap_matrix(raw_shap_values)

    feature_names = INVASIVE_COLUMNS if modality == "invasive" else list(df.columns)
    mean_abs_shap = np.abs(shap_matrix).mean(axis=0)
    mean_signed_shap = shap_matrix.mean(axis=0)

    feature_importance = []
    for idx, feature in enumerate(feature_names):
        feature_importance.append(
            {
                "feature": feature,
                "mean_abs_shap": float(mean_abs_shap[idx]),
                "mean_shap": float(mean_signed_shap[idx]),
            }
        )

    feature_importance.sort(key=lambda item: item["mean_abs_shap"], reverse=True)
    return feature_importance


# ---------- Groq summarization ----------
def _groq_client() -> Optional[Groq]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    return Groq(api_key=api_key)


def summarize_lime(modality: str, prediction: Dict, language: str = "en") -> Optional[str]:
    client = _groq_client()
    if not client:
        return None

    prompt = [
        "Explain this patient-specific LIME result as a prostate/urology decision-support expert.",
        _language_instruction(language),
        PROSTATE_DOMAIN_GUIDANCE,
        OUTPUT_RULES,
        "Patient-specific LIME rules:",
        "- Focus on this individual report; do not overgeneralize from global SHAP.",
        "- If probability is near the decision boundary, explicitly say the model confidence is limited.",
        "- Avoid vague phrases unless you explain what each supplied value means clinically and what it does not prove.",
        "- A fairness/bias audit is available in the project notebook. If race, diabetes, education, or region appears, explicitly say the driver may reflect dataset bias/proxy structure and must not guide care by itself.",
        "- For FTIR, do not call PCA components biomarkers. Explain them as compressed spectrum patterns and connect only at broad region/biomolecule level when supported.",
        "",
        f"Modality: {modality}",
        f"Predicted class: {prediction.get('prediction')}",
        f"Predicted probability (class 1): {prediction.get('probability')}",
        f"Top LIME features: {json.dumps(prediction.get('lime', {}).get('top_features', []))}",
    ]

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "\n".join(prompt)},
        ],
    )
    return response.choices[0].message.content.strip() if response.choices else None


def summarize_shap(modality: str, shap_result: Dict, language: str = "en") -> Optional[str]:
    client = _groq_client()
    if not client:
        return None

    prompt = [
        "Explain this model-wide SHAP result as a prostate/urology decision-support expert.",
        _language_instruction(language),
        PROSTATE_DOMAIN_GUIDANCE,
        OUTPUT_RULES,
        "Model-wide SHAP rules:",
        "- Focus on global model behavior, not this patient specifically.",
        "- Mention sample count and warn strongly if sample_count is very small.",
        "- Explain mean_abs_shap as average model influence and mean_shap as average direction toward class 1 or class 0.",
        "- Do not describe global SHAP as prostate cancer risk if this modality endpoint is predicting invasive modality need.",
        "- Avoid turning demographic or comorbidity associations into biological causes.",
        "",
        f"Modality: {modality}",
        f"Sample count: {shap_result.get('sample_count')}",
        f"Feature importance: {json.dumps(shap_result.get('global_importance', []))}",
    ]

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "\n".join(prompt)},
        ],
    )
    return response.choices[0].message.content.strip() if response.choices else None


# ---------- MLflow prediction logging ----------
def _log_prediction_to_mlflow(modality: str, df: pd.DataFrame, predicted_class: int,
                               probability: Optional[float], latency_ms: float):
    """Log a prediction run to the MLflow tracking server for audit."""
    if not _MLFLOW_AVAILABLE:
        return
    try:
        mlflow.set_experiment(EXPERIMENT_PREDICTIONS)
        with mlflow.start_run(run_name=f"predict-{modality}"):
            mlflow.log_param("modality", modality)
            mlflow.log_param("num_features", df.shape[1])
            mlflow.log_metric("predicted_class", predicted_class)
            if probability is not None:
                mlflow.log_metric("probability_class1", probability)
            mlflow.log_metric("latency_ms", latency_ms)
            # Log a compact representation of input features
            feature_summary = {col: float(df.iloc[0][col]) for col in df.columns[:20]}
            mlflow.log_dict(feature_summary, "input_features.json")
    except Exception as exc:
        log.warning("Failed to log prediction to MLflow: %s", exc)


# ---------- Core pipelines ----------
def predict_with_lime(modality: str, csv_text: str, model_type: str = "xgb", language: str = "en") -> Dict:
    t0 = time.time()
    df = parse_csv(modality, csv_text)
    model = load_model(modality, model_type)
    prediction = model.predict(df)
    predicted_class = int(prediction[0])

    probability = None
    try:
        probability_matrix = np.asarray(_build_probability_fn(model, list(df.columns))(df.to_numpy()))
        if probability_matrix.ndim == 2 and probability_matrix.shape[1] > 1:
            probability = float(probability_matrix[0][1])
    except Exception as exc:
        log.warning("Failed to calculate class probability; falling back to class label only: %s", exc)

    lime_features = build_lime(modality, model, df, predicted_class)
    latency_ms = (time.time() - t0) * 1000

    # Audit log to MLflow
    _log_prediction_to_mlflow(modality, df, predicted_class, probability, latency_ms)

    lime_feature_notes = [
        {
            "feature": item["feature"],
            "weight": item["weight"],
            "value": item["feature_value"],
            **_clinical_feature_note(item["feature"], item["feature_value"], item["weight"]),
        }
        for item in lime_features[:8]
    ]

    if modality == "non-invasive":
        lime_feature_notes = _component_feature_notes(df, lime_features)

    result = {
        "success": True,
        "prediction": predicted_class,
        "probability": probability,
        "lime": {"top_features": lime_features},
        "lime_feature_notes": lime_feature_notes,
        "latency_ms": round(latency_ms, 1),
    }

    # Include PCA-compressed data for downstream storage
    if modality == "non-invasive":
        result["pca_csv"] = df.to_csv(index=False)

    summary = summarize_lime(modality, result, language)
    if summary:
        result["lime_summary"] = summary

    return result


def shap_global(modality: str, csv_text: str, model_type: str = "xgb", language: str = "en") -> Dict:
    df = parse_csv(modality, csv_text)
    model = load_model(modality, model_type)

    feature_importance = build_shap(modality, model, df)

    result = {
        "success": True,
        "sample_count": int(df.shape[0]),
        "feature_count": int(df.shape[1]),
        "global_importance": feature_importance,
    }

    summary = summarize_shap(modality, result, language)
    if summary:
        result["shap_summary"] = summary

    return result
