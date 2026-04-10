import argparse
import json
import sys

from xai_core import predict_with_lime, shap_global


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Unified CLI for ProstAPP XAI tasks (predict/shap, invasive/non-invasive)."
    )
    parser.add_argument("task", choices=["predict", "shap"], help="Task to run")
    parser.add_argument("modality", choices=["invasive", "non-invasive"], help="Data modality")
    args = parser.parse_args()

    csv_data = sys.stdin.read()

    try:
        if args.task == "predict":
            result = predict_with_lime(args.modality, csv_data)
        else:
            result = shap_global(args.modality, csv_data)
    except Exception as exc:  # noqa: BLE001 - keep payload simple for Node bridge
        result = {"success": False, "error": str(exc)}

    print(json.dumps(result))


if __name__ == "__main__":
    main()
