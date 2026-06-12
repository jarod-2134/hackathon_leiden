#!/bin/bash

echo "=============================================="
echo "      Starting Nexus AI Study Companion"
echo "=============================================="

echo "[1/3] Checking virtual environment..."
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "[2/3] Activating environment and installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt

echo "[3/3] Starting the Server..."
echo "The app will be available at: http://127.0.0.1:8000/static/index.html"
echo "Press CTRL+C to stop the server."
echo ""
uvicorn main:app --reload
