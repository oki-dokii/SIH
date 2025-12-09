#!/bin/bash

# Start FastAPI backend on port 8000
uvicorn backend.app:app --host 127.0.0.1 --port 8000 &

# Wait for backend to start
sleep 2

# Start React dev server on port 5000 (proxies to port 8000)
cd frontend && npm run dev -- --host 0.0.0.0 --port 5000
