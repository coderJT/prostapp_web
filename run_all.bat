@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
rem remove trailing slash
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

:: Load root .env and .env.local if present
for %%F in (".env" ".env.local") do (
    if exist "%ROOT_DIR%\%%~F" (
        echo Loading env from %ROOT_DIR%\%%~F
        for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT_DIR%\%%~F") do (
            set "line=%%A"
            :: Check if not a comment or empty
            if not "!line:~0,1!"=="#" (
                if not "%%A"=="" if not "%%B"=="" (
                    set "%%A=%%B"
                )
            )
        )
    )
)

echo Checking required environment variables...

call :ensure_var SUPABASE_URL
if errorlevel 1 exit /b 1
call :ensure_var SUPABASE_KEY
if errorlevel 1 exit /b 1
call :ensure_var PORT
if errorlevel 1 exit /b 1
call :ensure_var GROQ_API_KEY
if errorlevel 1 exit /b 1
call :ensure_var GROQ_MODEL
if errorlevel 1 exit /b 1

echo All required variables are set.

if "%PORT%"=="" set "PORT=8888"
if "%XAI_PORT%"=="" set "XAI_PORT=8000"
if "%MLFLOW_PORT%"=="" set "MLFLOW_PORT=5001"

echo.
echo === MLflow Model Registration ===
cd /d "%ROOT_DIR%\app\backend\server"
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
)

if not exist "%ROOT_DIR%\mlflow_data\mlflow.db" (
    echo First run — registering models into MLflow...
    python register_models.py
) else (
    echo MLflow data store exists. Skipping registration.
)

echo.
echo Starting backend (Nodemon)...
cd /d "%ROOT_DIR%"
start "Backend API" cmd /c npm run dev:backend

echo Starting frontend (Vite)...
cd /d "%ROOT_DIR%\app\frontend"
start "Frontend UI" cmd /c npm run dev

echo Starting Python XAI service...
cd /d "%ROOT_DIR%\app\backend\server"
start "Python XAI" python ml_services.py

echo Starting MLflow Tracking UI...
cd /d "%ROOT_DIR%\app\backend\server"
start "MLflow UI" python start_mlflow_ui.py --port %MLFLOW_PORT%

echo.
echo ==============================================================
echo   Services started in separate windows:
echo   ------------------------------------------------------------
echo   * Backend API:        http://localhost:%PORT%
echo   * Frontend UI:        http://localhost:5173
echo   * Python XAI service: http://localhost:%XAI_PORT%
echo   * MLflow Dashboard:   http://localhost:%MLFLOW_PORT%
echo ==============================================================
echo.
echo Close the respective Command Prompt windows to stop services.
pause
exit /b

:ensure_var
set "key=%~1"
if not defined %key% (
    set /p "val=Enter value for %key%: "
    if "!val!"=="" (
        echo Missing required value for %key%. Exiting.
        exit /b 1
    )
    set "%key%=!val!"
)
exit /b 0
