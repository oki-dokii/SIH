#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  Warning: .env file not found. Please create one from .env.example"
    exit 1
fi

# Check if GEMINI_API_KEY is set
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  Error: GEMINI_API_KEY not set in .env file"
    exit 1
fi

# Set defaults
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}

# Create data directory if it doesn't exist
mkdir -p data

echo "🚀 Starting DPR Analyzer..."
echo "📍 Server will be available at: http://localhost:$PORT"
echo ""

# Run the application
uvicorn backend.app:app --reload --host $HOST --port $PORT