#!/usr/bin/env bash
# Unified launcher: verifies required env vars, prompts for missing ones,
# then starts backend API, frontend Vite dev server, Python XAI service,
# and the MLflow tracking dashboard.

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export MPLCONFIGDIR="${ROOT_DIR}/.cache/matplotlib"
mkdir -p "${MPLCONFIGDIR}"

require_command() {
  local command_name="$1"
  local install_hint="$2"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    echo "${install_hint}" >&2
    exit 1
  fi
}

file_hash() {
  python3 -c 'import hashlib, pathlib, sys; h = hashlib.sha256(); [h.update(pathlib.Path(p).read_bytes()) for p in sys.argv[1:]]; print(h.hexdigest())' "$@"
}

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

require_command "node" "Install Node.js 18 or newer, then rerun ./run_all.sh."
require_command "npm" "Install npm with Node.js, then rerun ./run_all.sh."
require_command "python3" "Install Python 3.9 or newer, then rerun ./run_all.sh."

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

# ---------- Resolve Node dependencies ----------

ensure_node_env() {
  local project_dir="$1"
  local label="$2"
  local package_json="${project_dir}/package.json"
  local package_lock="${project_dir}/package-lock.json"
  local node_modules="${project_dir}/node_modules"
  local npm_stamp="${node_modules}/.package-lock.sha256"
  local package_hash

  if [[ ! -f "${package_json}" ]]; then
    echo "Missing ${label} package.json at ${package_json}" >&2
    exit 1
  fi

  if [[ -f "${package_lock}" ]]; then
    package_hash="$(file_hash "${package_json}" "${package_lock}")"
  else
    package_hash="$(file_hash "${package_json}")"
  fi

  if [[ -d "${node_modules}" && -f "${npm_stamp}" && "$(cat "${npm_stamp}")" == "${package_hash}" ]]; then
    return 0
  fi

  echo "Installing ${label} npm dependencies..."
  (
    cd "${project_dir}"
    if [[ -f "${package_lock}" ]]; then
      if ! npm ci; then
        echo "package-lock.json is out of sync or npm ci failed. Running npm install for ${label}..."
        if ! npm install; then
          echo "Retrying ${label} npm install with --legacy-peer-deps..."
          npm install --legacy-peer-deps
        fi
      fi
    elif ! npm install; then
      echo "Retrying ${label} npm install with --legacy-peer-deps..."
      npm install --legacy-peer-deps
    fi

    if [[ -f "${package_lock}" ]]; then
      package_hash="$(file_hash "${package_json}" "${package_lock}")"
    else
      package_hash="$(file_hash "${package_json}")"
    fi

    if [[ ! -d "${node_modules}" ]]; then
      echo "npm install for ${label} did not create node_modules." >&2
      exit 1
    fi

    printf '%s\n' "${package_hash}" > "${npm_stamp}"
  )
}

ensure_node_env "${ROOT_DIR}" "backend/root"
ensure_node_env "${ROOT_DIR}/app/frontend" "frontend"

# ---------- Resolve Python venv ----------

PYTHON_VENV="${ROOT_DIR}/app/backend/server/.venv"
PYTHON_REQUIREMENTS="${ROOT_DIR}/app/backend/server/requirements.txt"
PYTHON_REQUIREMENTS_STAMP="${PYTHON_VENV}/.requirements.sha256"

ensure_python_env() {
  if [[ ! -f "${PYTHON_VENV}/bin/activate" ]]; then
    echo "Creating Python virtual environment at ${PYTHON_VENV}..."
    python3 -m venv "${PYTHON_VENV}" || {
      echo "Unable to create Python virtual environment. Make sure Python 3 includes the venv module." >&2
      exit 1
    }
  fi

  # shellcheck source=/dev/null
  source "${PYTHON_VENV}/bin/activate"

  local requirements_hash
  requirements_hash="$(file_hash "${PYTHON_REQUIREMENTS}")"

  if [[ ! -f "${PYTHON_REQUIREMENTS_STAMP}" ]] || [[ "$(cat "${PYTHON_REQUIREMENTS_STAMP}")" != "${requirements_hash}" ]]; then
    echo "Installing Python requirements..."
    python -m pip install --upgrade pip
    pip install -r "${PYTHON_REQUIREMENTS}"
    printf '%s\n' "${requirements_hash}" > "${PYTHON_REQUIREMENTS_STAMP}"
  fi
}

activate_venv() {
  # shellcheck source=/dev/null
  source "${PYTHON_VENV}/bin/activate"
}

ensure_python_env

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
  npm run dev -- --host 127.0.0.1
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
