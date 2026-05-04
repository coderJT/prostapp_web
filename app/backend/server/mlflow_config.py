"""
MLflow configuration for ProstAPP production simulation.

Centralises tracking URI, experiment names, and model registry names
so every module resolves to the same artifact store.
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Tracking URI – defaults to a SQLite database in a local directory.
# Override via the MLFLOW_TRACKING_URI env-var for remote stores.
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_STORE_DIR = _PROJECT_ROOT / "mlflow_data"
_DEFAULT_DB = f"sqlite:///{_DEFAULT_STORE_DIR / 'mlflow.db'}"

TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", _DEFAULT_DB)
ARTIFACT_ROOT = str(_DEFAULT_STORE_DIR / "artifacts")
MLFLOW_PORT = int(os.getenv("MLFLOW_PORT", "5001"))

# ---------------------------------------------------------------------------
# Experiment & model registry constants
# ---------------------------------------------------------------------------
EXPERIMENT_TRAINING = "prostapp-models"       # houses model registration runs
EXPERIMENT_PREDICTIONS = "prostapp-predictions"  # houses prediction audit logs

MODEL_INVASIVE = "prostapp-invasive"          # LightGBM  (clinical / PSA)
MODEL_NON_INVASIVE = "prostapp-non-invasive"  # XGBoost   (FTIR)

# Alias used when loading the "production" version
PRODUCTION_ALIAS = "champion"


def configure_mlflow():
    """Set the MLflow tracking URI globally (idempotent)."""
    # Ensure the storage directory exists
    _DEFAULT_STORE_DIR.mkdir(parents=True, exist_ok=True)
    import mlflow
    mlflow.set_tracking_uri(TRACKING_URI)
    return TRACKING_URI
