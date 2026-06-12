@echo off
echo ==============================================
echo       Starting Nexus AI Study Companion
echo ==============================================

echo [1/3] Checking virtual environment...
IF NOT EXIST venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo [2/3] Activating environment and installing dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo [3/3] Starting the Server...
echo The app will be available at: http://127.0.0.1:8000/static/index.html
echo Press CTRL+C to stop the server.
echo.
uvicorn main:app --reload
