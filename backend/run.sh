#!/bin/bash
# Run Quantum Mus Backend Server

echo "========================================"
echo "  Quantum Mus Backend Server"
echo "========================================"
echo

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt --quiet
echo

# Run server
echo "Starting server on https://quantum-mus-backend.onrender.com/"
echo "Press Ctrl+C to stop"
echo
python server.py
