#!/usr/bin/env python3
"""
Launch the MLflow Tracking UI for ProstAPP.

Usage:
    python start_mlflow_ui.py          # uses defaults from mlflow_config
    python start_mlflow_ui.py --port 5002
"""

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mlflow_config import MLFLOW_PORT, TRACKING_URI, ARTIFACT_ROOT


def main():
    parser = argparse.ArgumentParser(description="Start the MLflow tracking UI.")
    parser.add_argument("--port", type=int, default=MLFLOW_PORT, help="Port for the UI")
    args = parser.parse_args()

    print(f"Starting MLflow UI on http://localhost:{args.port}")
    print(f"Backend store: {TRACKING_URI}")
    print(f"Artifact root: {ARTIFACT_ROOT}")

    try:
        subprocess.run(
            [
                sys.executable, "-m", "mlflow", "ui",
                "--backend-store-uri", TRACKING_URI,
                "--default-artifact-root", ARTIFACT_ROOT,
                "--host", "0.0.0.0",
                "--port", str(args.port),
            ],
            check=True,
        )
    except KeyboardInterrupt:
        print("\nMLflow UI stopped.")


if __name__ == "__main__":
    main()
