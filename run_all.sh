#!/usr/bin/env bash
# Unified launcher: verifies required env vars, prompts for missing ones,
# then starts backend API, frontend Vite dev server, Python XAI service,
# and the MLflow tracking dashboard.

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REQUIRED_KEYS=(
  SUPABASE_URL
  SUPABASE_KEY
  PORT
  GROQ_API_KEY
  GROQ_MODEL
)

# Load root .env and .env.local if present
for env_file in "${ROOT_DIR}/.env" "${ROOT_DIR}/.env.local"; do
  if [[ -f "$env_file" ]]; then
    echo "Loading env from $env_file"
    set -a
    # shellcheck source=/dev/null
    source "$env_file"
    set +a
  fi
done

ensure_var() {
  local key="$1"
  local current="${!key-}"
  if [[ -n "$current" ]]; then
    return 0
  fi
  read -r -p "Enter value for ${key}: " value
  if [[ -z "$value" ]]; then
    echo "Missing required value for ${key}. Exiting." >&2
    exit 1
  fi
  export "${key}=${value}"
}

echo "Checking required environment variables..."
for k in "${REQUIRED_KEYS[@]}"; do
  ensure_var "$k"
done
echo "All required variables are set."

cleanup() {
  echo "Stopping services..."
  [[ -n "${BACKEND_PID-}" ]] && kill "${BACKEND_PID}" 2>/dev/null || true
  [[ -n "${FRONTEND_PID-}" ]] && kill "${FRONTEND_PID}" 2>/dev/null || true
  [[ -n "${PYTHON_PID-}" ]] && kill "${PYTHON_PID}" 2>/dev/null || true
  [[ -n "${MLFLOW_PID-}" ]] && kill "${MLFLOW_PID}" 2>/dev/null || true
}
trap cleanup EXIT

force_kill_ports() {
  echo "Ensuring ports are free..."
  local ports=("${PORT:-8888}" 5173 "${XAI_PORT:-8000}" "${MLFLOW_PORT:-5001}")
  for p in "${ports[@]}"; do
    local pid=$(lsof -ti :$p 2>/dev/null)
    if [[ -n "$pid" ]]; then
      echo "Killing stray process $pid on port $p"
      kill -9 $pid 2>/dev/null || true
    fi
  done
}

force_kill_ports

# ---------- Resolve Python venv ----------

PYTHON_VENV="${ROOT_DIR}/app/backend/server/.venv"

activate_venv() {
  if [[ -n "${PYTHON_VENV}" ]]; then
    # shellcheck source=/dev/null
    source "${PYTHON_VENV}/bin/activate"
    pip install -r "${ROOT_DIR}/app/backend/server/requirements.txt"
  fi
}

# ---------- MLflow model registration (idempotent) ----------
MLFLOW_PORT="${MLFLOW_PORT:-5001}"
MLFLOW_DIR="${ROOT_DIR}/mlflow_data"

echo ""
echo "=== MLflow Model Registration ==="
(
  cd "${ROOT_DIR}/app/backend/server"
  activate_venv
  if [[ ! -f "${MLFLOW_DIR}/mlflow.db" ]]; then
    echo "First run — registering models into MLflow..."
    python register_models.py
  else
    echo "MLflow data store exists. Skipping registration (run register_models.py manually to re-register)."
  fi
)

# ---------- Start services ----------
echo ""
echo "Starting backend (Nodemon)..."
(
  cd "${ROOT_DIR}"
  npm run dev:backend
) &
BACKEND_PID=$!

echo "Starting frontend (Vite)..."
(
  cd "${ROOT_DIR}/app/frontend"
  npm run dev
) &
FRONTEND_PID=$!

echo "Starting Python XAI service..."
(
  cd "${ROOT_DIR}/app/backend/server"
  activate_venv
  python ml_services.py
) &
PYTHON_PID=$!

echo "Starting MLflow Tracking UI..."
(
  cd "${ROOT_DIR}/app/backend/server"
  activate_venv
  python start_mlflow_ui.py --port "${MLFLOW_PORT}"
) &
MLFLOW_PID=$!

cat <<MSG

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Services started:
  ─────────────────────────────────────────────
  • Backend API:        http://localhost:${PORT:-8888}
  • Frontend UI:        http://localhost:5173
  • Python XAI service: http://localhost:${XAI_PORT:-8000}
  • MLflow Dashboard:   http://localhost:${MLFLOW_PORT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Press Ctrl+C to stop all.
MSG

wait
