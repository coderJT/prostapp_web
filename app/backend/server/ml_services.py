import os
import threading
from contextlib import contextmanager
from flask import Flask, jsonify, request
from flask_cors import CORS

from xai_core import predict_with_lime, shap_global

app = Flask(__name__)
CORS(app)

MODALITY_ALIASES = {
    "psa": "invasive",
    "invasive": "invasive",
    "ftir": "non-invasive",
    "non-invasive": "non-invasive",
    "noninvasive": "non-invasive",
}
SUPPORTED_LANGUAGES = {"en", "ms", "zh"}
_prediction_locks = {}
_prediction_locks_guard = threading.Lock()


def _request_language() -> str:
    language = request.form.get("language", request.args.get("language", "en"))
    return language if language in SUPPORTED_LANGUAGES else "en"


def _request_queue_key() -> str:
    user_email = request.form.get("userEmail") or request.headers.get("x-user-email") or "anonymous"
    return user_email.strip().lower() or "anonymous"


@contextmanager
def _queued_prediction(key: str):
    with _prediction_locks_guard:
        lock = _prediction_locks.setdefault(key, threading.Lock())
    lock.acquire()
    try:
        yield
    finally:
        lock.release()

# ---------------------------------------------------------------------------
# MLflow helpers (optional — degrade gracefully)
# ---------------------------------------------------------------------------
try:
    import mlflow
    from mlflow.tracking import MlflowClient
    from mlflow_config import (
        EXPERIMENT_PREDICTIONS,
        MODEL_INVASIVE,
        MODEL_NON_INVASIVE,
        TRACKING_URI,
        MLFLOW_PORT,
        configure_mlflow,
    )
    configure_mlflow()
    _MLFLOW_OK = True
except Exception:
    _MLFLOW_OK = False


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "xai",
        "groq_enabled": bool(os.getenv("GROQ_API_KEY")),
        "mlflow_enabled": _MLFLOW_OK,
    })


# ---------------------------------------------------------------------------
# XAI prediction / SHAP endpoints (unchanged logic)
# ---------------------------------------------------------------------------
@app.post("/xai/predict/<modality>")
def predict(modality: str):
    modality = MODALITY_ALIASES.get(modality.lower(), modality)
    if modality not in {"invasive", "non-invasive"}:
        return jsonify({"success": False, "error": "Unsupported modality. Use 'invasive' or 'non-invasive'."}), 400

    file = request.files.get("file")
    if not file:
        return jsonify({"success": False, "error": "CSV file is required (multipart 'file')."}), 400

    try:
        csv_text = file.stream.read().decode("utf-8")
        model_type = request.form.get("model_type", request.args.get("model_type", "xgb"))
        with _queued_prediction(_request_queue_key()):
            result = predict_with_lime(modality, csv_text, model_type, _request_language())
        return jsonify(result)
    except Exception as exc:  # pylint: disable=broad-except
        return jsonify({"success": False, "error": str(exc)}), 500


@app.post("/xai/shap/<modality>")
def shap_endpoint(modality: str):
    modality = MODALITY_ALIASES.get(modality.lower(), modality)
    if modality not in {"invasive", "non-invasive"}:
        return jsonify({"success": False, "error": "Unsupported modality. Use 'invasive' or 'non-invasive'."}), 400

    file = request.files.get("file")
    if not file:
        return jsonify({"success": False, "error": "CSV file is required (multipart 'file')."}), 400

    try:
        csv_text = file.stream.read().decode("utf-8")
        model_type = request.form.get("model_type", request.args.get("model_type", "xgb"))
        with _queued_prediction(_request_queue_key()):
            result = shap_global(modality, csv_text, model_type, _request_language())
        return jsonify(result)
    except Exception as exc:  # pylint: disable=broad-except
        return jsonify({"success": False, "error": str(exc)}), 500


# ---------------------------------------------------------------------------
# /api/* aliases — the Vercel frontend hits /api/predict-invasive etc.
# These delegate to the existing handlers above.
# ---------------------------------------------------------------------------
@app.post("/api/predict-invasive")
def api_predict_invasive():
    """Alias for /xai/predict/invasive used by the frontend."""
    return predict("invasive")


@app.post("/api/predict-ftir")
def api_predict_ftir():
    """Alias for /xai/predict/non-invasive used by the frontend."""
    return predict("ftir")


@app.post("/api/shap-invasive")
def api_shap_invasive():
    """Alias for /xai/shap/invasive used by the frontend."""
    return shap_endpoint("invasive")


@app.post("/api/shap-ftir")
def api_shap_ftir():
    """Alias for /xai/shap/non-invasive used by the frontend."""
    return shap_endpoint("ftir")


# ---------------------------------------------------------------------------
# MLflow dashboard API endpoints
# ---------------------------------------------------------------------------
@app.get("/mlflow/status")
def mlflow_status():
    """Return MLflow registry status: tracking URI, registered models, versions."""
    if not _MLFLOW_OK:
        return jsonify({"success": False, "error": "MLflow is not configured"}), 503

    client = MlflowClient()
    models_info = []
    for name in [MODEL_INVASIVE, MODEL_NON_INVASIVE]:
        try:
            versions = client.get_latest_versions(name)
            models_info.append({
                "name": name,
                "latest_version": versions[-1].version if versions else None,
                "status": versions[-1].status if versions else "NOT_REGISTERED",
                "run_id": versions[-1].run_id if versions else None,
            })
        except Exception:
            models_info.append({"name": name, "status": "NOT_REGISTERED"})

    return jsonify({
        "success": True,
        "tracking_uri": TRACKING_URI,
        "dashboard_url": f"http://localhost:{MLFLOW_PORT}",
        "models": models_info,
    })


@app.get("/mlflow/predictions")
def mlflow_predictions():
    """Return recent prediction runs logged in MLflow."""
    if not _MLFLOW_OK:
        return jsonify({"success": False, "error": "MLflow is not configured"}), 503

    client = MlflowClient()
    try:
        experiment = client.get_experiment_by_name(EXPERIMENT_PREDICTIONS)
        if not experiment:
            return jsonify({"success": True, "predictions": [], "total": 0})

        runs = client.search_runs(
            experiment_ids=[experiment.experiment_id],
            order_by=["start_time DESC"],
            max_results=50,
        )

        predictions = []
        for run in runs:
            predictions.append({
                "run_id": run.info.run_id,
                "start_time": run.info.start_time,
                "modality": run.data.params.get("modality"),
                "predicted_class": run.data.metrics.get("predicted_class"),
                "probability": run.data.metrics.get("probability_class1"),
                "latency_ms": run.data.metrics.get("latency_ms"),
            })

        return jsonify({"success": True, "predictions": predictions, "total": len(predictions)})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


if __name__ == "__main__":
    host = os.getenv("XAI_HOST", "0.0.0.0")
    port = int(os.getenv("XAI_PORT", "8000"))
    app.run(host=host, port=port, threaded=True)
