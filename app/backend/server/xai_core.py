import gc
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
    "You summarize medical ML explainability outputs (SHAP/LIME) in plain, concise language "
    "for research dashboards. Avoid diagnosis claims and keep uncertainty explicit."
)


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
    # Prefer MLflow registry; fall back to local joblib
    model = _load_from_mlflow(modality)
    if model is not None:
        return model

    if modality == "invasive":
        return joblib.load(INVASIVE_MODEL_PATH)
    if modality == "non-invasive":
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


def summarize_lime(modality: str, prediction: Dict) -> Optional[str]:
    client = _groq_client()
    if not client:
        return None

    prompt = [
        "Summarize this local LIME explanation in 3-4 sentences for a prediction details panel.",
        "Requirements:",
        "1) Mention the predicted class and probability (if present).",
        "2) Mention the strongest positive and negative feature effects by absolute weight.",
        "3) Add one short caution that this is model-based support, not diagnosis.",
        "Return plain text only.",
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


def summarize_shap(modality: str, shap_result: Dict) -> Optional[str]:
    client = _groq_client()
    if not client:
        return None

    prompt = [
        "Summarize this global SHAP output in 3-4 sentences for a dashboard overview card.",
        "Requirements:",
        "1) State the most influential features by mean absolute SHAP.",
        "2) Briefly explain what positive/negative mean SHAP direction implies.",
        "3) Add one short caution that these are associations, not causal effects.",
        "Return plain text only.",
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
def predict_with_lime(modality: str, csv_text: str, model_type: str = "xgb") -> Dict:
    t0 = time.time()
    df = parse_csv(modality, csv_text)
    model = load_model(modality, model_type)
    prediction = model.predict(df)
    predicted_class = int(prediction[0])

    probability = None
    if hasattr(model, "predict_proba"):
        raw_probability = np.asarray(model.predict_proba(df))
        if raw_probability.ndim == 2 and raw_probability.shape[1] > 1:
            probability = float(raw_probability[0][1])

    lime_features = build_lime(modality, model, df, predicted_class)
    latency_ms = (time.time() - t0) * 1000

    # Audit log to MLflow
    _log_prediction_to_mlflow(modality, df, predicted_class, probability, latency_ms)

    result = {
        "success": True,
        "prediction": predicted_class,
        "probability": probability,
        "lime": {"top_features": lime_features},
        "latency_ms": round(latency_ms, 1),
    }

    # Include PCA-compressed data for downstream storage
    if modality == "non-invasive":
        result["pca_csv"] = df.to_csv(index=False)

    summary = summarize_lime(modality, result)
    if summary:
        result["lime_summary"] = summary

    # Aggressively release RAM after heavy explanation compute
    gc.collect()

    return result


def shap_global(modality: str, csv_text: str, model_type: str = "xgb") -> Dict:
    df = parse_csv(modality, csv_text)
    model = load_model(modality, model_type)

    feature_importance = build_shap(modality, model, df)

    result = {
        "success": True,
        "sample_count": int(df.shape[0]),
        "feature_count": int(df.shape[1]),
        "global_importance": feature_importance,
    }

    summary = summarize_shap(modality, result)
    if summary:
        result["shap_summary"] = summary

    # Aggressively release RAM after heavy explanation compute
    gc.collect()

    return result
