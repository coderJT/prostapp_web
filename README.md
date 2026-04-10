# ProstAPP

Active stack:
- Frontend UI: `app/frontend` (React + Vite + Tailwind v4)
- Backend API: `app/backend` (Express + Supabase + ML helpers)

## Project Structure
```
ProstAPP/
├── app/
│   ├── backend/        # Node.js Express API + Python ML bridge
│   └── frontend/       # React UI (moved from "Prostate Cancer Risk Platform")
├── ML/                 # Trained models and notebooks
├── data/               # Sample CSVs for quick tests
└── run_all.sh, package.json, etc.
```

## Prerequisites
- Node.js ≥ 18
- Python ≥ 3.9 (with `joblib`, `lightgbm`, `xgboost`, `pandas`, `numpy`, `scikit-learn`, `shap`, `lime`)
- Supabase project (URL + anon key)

## Environment Variables
Create `.env.local` in the **repo root**:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_anon_key
PORT=8888
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
```

## Run the App
Open two terminals from the repository root.

**Backend**
```bash
cd app/backend
npm install
node app.js
```
Runs at http://localhost:8888.

**Frontend**
```bash
cd app/frontend
npm install           # add --legacy-peer-deps if npm complains
npm run dev
```
Runs at http://localhost:5173 (or next available port).

## Quick Health Check
```bash
curl -s http://localhost:8888/api/education/sources
```
Expect JSON with `success: true` and education payload.

## Notes
- The legacy folder `Prostate Cancer Risk Platform/` has been relocated into `app/frontend/`.
- Model artifacts live in `ML/`; sample data lives in `data/`.
