# ProstAPP

ProstAPP is a prostate cancer risk-assessment web app with a React frontend, an Express API, Supabase-backed user data, and a Python XAI service for model predictions and LIME/SHAP explanations.

## Active Stack

- Frontend: `app/frontend` (`React 18`, `Vite 6`, `Tailwind CSS 4`, React Router, Radix UI/shadcn-style components)
- Backend API: `app/backend` (`Express 5`, Supabase service client, Groq-backed explanation summaries)
- XAI service: `app/backend/server` (`Flask`, `scikit-learn`, `LightGBM`, `XGBoost`, `LIME`, `SHAP`, optional MLflow)
- Data store: Supabase tables defined in `app/backend/sql`
- Deployment entrypoint: `api/index.js`, which exports the Express app for Vercel

## Current Product Surface

- Authentication: email/password signup and login through Supabase Auth, plus a Google OAuth start endpoint.
- Dashboard routes: risk assessment, results, medical history, history report, education, appointments, mail, and profile.
- Admin route: `/admin`.
- Risk workflows:
  - Manual/form assessment history.
  - Invasive CSV prediction.
  - FTIR/non-invasive CSV prediction.
  - Patient-specific LIME explanations.
  - Global SHAP explanations.
- Explainability summaries: optional Groq LLM summaries for LIME/SHAP in English, Bahasa Malaysia, or Chinese.
- Reports: persistent history in `prediction_reports`, including risk scores, prediction classes, LIME/SHAP summaries, top features, and feature notes.
- Appointments: clinician lookup, available-slot lookup, booking, updating, cancellation/status handling, and appointment notifications.
- Notifications: unread counts, mark-one-read, mark-all-read, and day-before appointment reminders.
- Education: curated prostate cancer resources from NCI, CDC, ACS, Mayo Clinic, PCF, and Urology Care Foundation, with live page-title fetching when available.
- UI updates: site-wide English/Bahasa Malaysia/Chinese translation support, dark-mode rendering fixes, and mobile navigation overflow fixes.

## Repository Layout

```text
ProstAPP/
├── api/index.js                    # Vercel serverless entrypoint for the Express app
├── app/
│   ├── backend/
│   │   ├── app.js                  # Express app and route mounting
│   │   ├── config/supabase.js      # Supabase service client
│   │   ├── routes/                 # API route modules
│   │   ├── server/                 # Flask XAI service, MLflow helpers, Python requirements
│   │   ├── services/               # XAI proxy and Groq summary helpers
│   │   └── sql/                    # Supabase table definitions
│   └── frontend/
│       ├── src/app/pages/          # React pages
│       ├── src/app/components/     # Shared UI and providers
│       ├── src/app/lib/            # API, Supabase, language helpers
│       └── vite.config.ts          # Vite config and local /api proxy
├── ML/
│   ├── models/                     # Trained model artifacts
│   ├── data/                       # Processed arrays and dictionary image
│   └── notebooks/                  # Training/exploration notebooks
├── data/test/                      # Test CSVs
├── run_all.sh                      # macOS/Linux launcher
├── run_all.bat                     # Windows launcher
├── package.json                    # Root/backend scripts and dependencies
└── vercel.json                     # Vercel build output and rewrites
```

## Prerequisites

- Node.js 18 or newer
- npm
- Python 3.9 or newer with `venv`
- Supabase project
- Groq API key if LLM-generated explanation summaries are required

Python dependencies are listed in `app/backend/server/requirements.txt`.

## Environment Variables

Create `.env.local` in the repository root. The backend loads `.env` first, then `.env.local` with override enabled.

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_KEY=your_supabase_key_used_by_the_launcher
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

PORT=8888
XAI_SERVICE_URL=http://localhost:8000
VITE_API_BASE_URL=http://127.0.0.1:8888
XAI_PORT=8000
MLFLOW_PORT=5001

GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is required for backend admin operations such as signup sync and database writes.
- `SUPABASE_KEY` is required by `run_all.sh`. The backend can use it as a fallback when `SUPABASE_SERVICE_ROLE_KEY` is absent, so use a service-role key only in trusted backend/server environments.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the frontend-safe Supabase values.
- `XAI_SERVICE_URL` tells the Express API where to send prediction and SHAP/LIME requests.
- `VITE_API_BASE_URL` controls the local Vite `/api` proxy target. The frontend request helper uses relative `/api` paths.
- `GROQ_API_KEY` is optional at runtime; without it, prediction endpoints still return primary model output, but LLM summary fields are omitted.

## Database Setup

Run the SQL files in `app/backend/sql` against the Supabase `public` schema:

```text
app/backend/sql/users.sql
app/backend/sql/appointments.sql
app/backend/sql/notifications.sql
app/backend/sql/prediction_reports.sql
```

The app expects these tables:

- `users`: profile mirror with custom patient/clinician IDs such as `P0001` and `C0001`.
- `appointments`: appointment booking and status records.
- `notifications`: appointment notifications and read state.
- `prediction_reports`: manual and model-generated assessment history.

The prediction route also attempts to write raw prediction output to `prediction_results`. That table definition is not currently included in `app/backend/sql`; if it is absent, the prediction response still succeeds and includes a `database_save` error object.

## Install

Install root/backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd app/frontend
npm install
```

Install Python dependencies manually if you are not using `run_all.sh`:

```bash
cd app/backend/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run Locally

### Recommended: all services

macOS/Linux:

```bash
./run_all.sh
```

Windows:

```bat
run_all.bat
```

The launcher starts:

- Backend API: `http://localhost:8888`
- Frontend UI: `http://localhost:5173`
- Python XAI service: `http://localhost:8000`
- MLflow dashboard: `http://localhost:5001`

`run_all.sh` also installs missing Node/Python dependencies, creates `app/backend/server/.venv`, frees the configured ports, and performs first-run MLflow model registration when `mlflow_data/mlflow.db` is missing.

### Manual service startup

Terminal 1, backend API:

```bash
npm run dev:backend
```

Terminal 2, frontend:

```bash
cd app/frontend
npm run dev
```

Terminal 3, Python XAI service:

```bash
cd app/backend/server
source .venv/bin/activate
python ml_services.py
```

Optional MLflow UI:

```bash
cd app/backend/server
source .venv/bin/activate
python start_mlflow_ui.py --port 5001
```

## Health Checks

Backend:

```bash
curl -s http://localhost:8888/health
```

XAI service:

```bash
curl -s http://localhost:8000/health
```

Education API:

```bash
curl -s http://localhost:8888/api/education/sources
```

Expected successful responses include `"success": true` for API routes or `"status": "ok"` for health routes.

## Main API Routes

Backend routes mounted from `app/backend/app.js`:

```text
GET    /health

POST   /api/predict-invasive
POST   /api/predict-ftir
POST   /api/shap-invasive
POST   /api/shap-ftir

GET    /api/auth/google/start
GET    /api/auth/me
POST   /api/auth/signup
POST   /api/auth/login

GET    /api/education/sources

GET    /api/appointments/clinicians
GET    /api/appointments/available-slots/:clinicianEmail?date=YYYY-MM-DD
GET    /api/appointments
POST   /api/appointments
PATCH  /api/appointments/:id
DELETE /api/appointments/:id

GET    /api/notifications?email=user@example.com
GET    /api/notifications/unread-count?email=user@example.com
PATCH  /api/notifications/mark-all-read
PATCH  /api/notifications/:id/read

GET    /api/reports?userEmail=user@example.com
POST   /api/reports
DELETE /api/reports
```

Python XAI routes in `app/backend/server/ml_services.py`:

```text
GET    /health
POST   /xai/predict/invasive
POST   /xai/predict/non-invasive
POST   /xai/shap/invasive
POST   /xai/shap/non-invasive
POST   /api/predict-invasive
POST   /api/predict-ftir
POST   /api/shap-invasive
POST   /api/shap-ftir
GET    /mlflow/status
GET    /mlflow/predictions
```

Prediction and SHAP/LIME endpoints expect multipart form data with a CSV file field named `file`. Optional fields include `modelType` or `model_type`, and `language` with one of `en`, `ms`, or `zh`.

## Frontend Routes

```text
/
/login
/signup
/dashboard
/dashboard/risk-assessment
/dashboard/medical-history
/dashboard/results
/dashboard/education
/dashboard/appointments
/dashboard/mail
/dashboard/profile
/dashboard/history-report
/admin
```

`/dashboard/report-explanations` and `/dashboard/groq-answers` redirect to `/dashboard/history-report`.

## Build

Build the frontend through the root package:

```bash
npm run build
```

This runs `npm --prefix app/frontend run build` and outputs the production bundle to `app/frontend/dist`.

## Deployment Notes

- `vercel.json` builds with `npm run build` and serves `app/frontend/dist`.
- `/api/(.*)` rewrites to `api/index.js`, which exports the Express app.
- All non-API paths rewrite to `/index.html` for React Router.
- In production, set the same Supabase and Groq environment variables in the deployment environment.
- If the Python XAI service is deployed separately, set `XAI_SERVICE_URL` to that service URL.
