@echo off
echo ==============================================
echo       Starting Nexus AI Study Companion
echo ==============================================

echo [1/4] Checking virtual environment...
IF NOT EXIST venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo [2/4] Activating environment and installing dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo [3/4] Starting the Server in the background...
echo The app will be available at: http://127.0.0.1:8000/static/index.html
echo.

start /B uvicorn main:app --reload

echo [4/4] Waiting 5 seconds for the server port to open...
timeout /t 5 /nobreak >nul

echo Triggering background document summarizer...
powershell -Command "Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/get_model' -Method Get" >nul 2>&1

echo.
echo ==============================================
echo Nexus AI is fully initialized and operational!
echo Press CTRL+C in this window to stop the server.
echo ==============================================

pause >nul