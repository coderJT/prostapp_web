#!/usr/bin/env python3
"""
Register the existing ProstAPP joblib models into the MLflow Model Registry.

Run once (or whenever models are retrained) to publish new versions:

    python register_models.py

The script is idempotent — re-running it creates a new version each time,
which is fine; the latest version automatically becomes the "champion".
"""

import sys
from pathlib import Path

# Ensure the server directory is on the path so sibling imports work.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import joblib
import mlflow
import mlflow.sklearn
from mlflow.tracking import MlflowClient

from mlflow_config import (
    ARTIFACT_ROOT,
    EXPERIMENT_TRAINING,
    MODEL_INVASIVE,
    MODEL_NON_INVASIVE,
    PRODUCTION_ALIAS,
    configure_mlflow,
)

# Paths to existing model artefacts
ROOT_DIR = Path(__file__).resolve().parents[3]
INVASIVE_MODEL_PATH = ROOT_DIR / "ML" / "models" / "lgbm_clinical.joblib"
NON_INVASIVE_MODEL_PATH = ROOT_DIR / "ML" / "models" / "xgb_FTIR.joblib"

INVASIVE_COLUMNS = [
    "age", "psa_(ng/ml)", "body_weight_(kg)", "height_(cm)",
    "family_history_prostate_cancer", "educational_background",
    "hypertension", "heart_disease", "cerebro_vascular_disease",
    "hyperlipidemia", "diabetes_melitus", "renal_disease",
    "other_cancer", "other_disease", "region_Rural",
    "race_C", "race_I", "race_M",
]


def _register_one(model_path: Path, registry_name: str, modality: str, feature_names: list | None):
    """Load a joblib model, log it to MLflow, and register + alias it."""
    model = joblib.load(model_path)

    mlflow.set_experiment(EXPERIMENT_TRAINING)
    with mlflow.start_run(run_name=f"register-{registry_name}") as run:
        # Log metadata
        mlflow.log_param("modality", modality)
        mlflow.log_param("source_file", str(model_path))
        mlflow.log_param("model_type", type(model).__name__)
        if feature_names:
            mlflow.log_param("feature_count", len(feature_names))
            # Store feature list as a tag (truncated if very long)
            mlflow.set_tag("features", ", ".join(feature_names)[:5000])

        # Log the model artefact
        mlflow.sklearn.log_model(
            sk_model=model,
            artifact_path="model",
            registered_model_name=registry_name,
        )

        print(f"✓ Logged {registry_name} (run {run.info.run_id})")

    # Set the "champion" alias on the latest version
    client = MlflowClient()
    latest = client.get_latest_versions(registry_name)
    if latest:
        version = latest[-1].version
        try:
            client.set_registered_model_alias(registry_name, PRODUCTION_ALIAS, version)
            print(f"  → Alias '{PRODUCTION_ALIAS}' set to version {version}")
        except Exception as exc:
            # Older MLflow versions may not support aliases; fall back to stage transition.
            print(f"  (alias not supported: {exc}; skipping)")


def main():
    tracking_uri = configure_mlflow()
    print(f"MLflow tracking URI: {tracking_uri}\n")

    if not INVASIVE_MODEL_PATH.exists():
        print(f"ERROR: Invasive model not found at {INVASIVE_MODEL_PATH}", file=sys.stderr)
        sys.exit(1)
    if not NON_INVASIVE_MODEL_PATH.exists():
        print(f"ERROR: Non-invasive model not found at {NON_INVASIVE_MODEL_PATH}", file=sys.stderr)
        sys.exit(1)

    _register_one(INVASIVE_MODEL_PATH, MODEL_INVASIVE, "invasive", INVASIVE_COLUMNS)
    _register_one(NON_INVASIVE_MODEL_PATH, MODEL_NON_INVASIVE, "non-invasive", None)

    print("\n✅ All models registered successfully.")


if __name__ == "__main__":
    main()
