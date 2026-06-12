#!/bin/bash

echo "=============================================="
echo "       Starting Nexus AI Study Companion"
echo "=============================================="

echo "[1/4] Checking virtual environment..."
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "[2/4] Activating environment and installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt

echo "[3/4] Starting the Server in the background..."
echo "The app will be available at: http://127.0.0.1:8000/static/index.html"
echo ""

uvicorn main:app --reload &

SERVER_PID=$!

echo "[4/4] Waiting 5 seconds for the server port to open..."
sleep 5

echo "Triggering background document summarizer..."
curl -s -X GET "http://127.0.0.1:8000/api/get_model" > /dev/null

echo ""
echo "=============================================="
echo "Nexus AI is fully initialized and operational!"
echo "Press CTRL+C to stop the server."
echo "=============================================="

fg %1 2>/dev/null || wait $SERVER_PID