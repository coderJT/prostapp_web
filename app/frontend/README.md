
# Prostate Cancer Risk Platform

Active frontend UI for ProstAPP.

Original Figma design: https://www.figma.com/design/QJRcS9ZMa4pYos5kf2BeTA/Prostate-Cancer-Risk-Platform

## Latest Execution Format

Run frontend and backend in separate terminals.

### Backend (required)

From repository root:

```powershell
cd app/backend
npm install
node app.js
```

Backend URL: `http://localhost:8888`

### Frontend UI

From this folder:

```powershell
npm install
npm run dev
```

Frontend URL: `http://localhost:5173` (or next available Vite port)

## Troubleshooting

- If install fails due to peer dependencies:

```powershell
npm install --legacy-peer-deps
```

- If Vite cache issues appear:

```powershell
Remove-Item -Path .vite -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```
  