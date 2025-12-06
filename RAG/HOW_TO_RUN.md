# 🚀 How to Run the Application

## Prerequisites
- Python 3.8+ with all dependencies installed
- Node.js 16+ and npm
- Ollama running locally

## Step 1: Start the Backend

Open Terminal 1:
```bash
cd C:\Users\Aangir Doshi\OneDrive\Desktop\RAG
python server.py
```

You should see:
```
✓ Database initialized: data\chat.db
🤖 Initializing RAG Engine...
✓ RAG Engine ready
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Step 2: Start the Frontend

Open Terminal 2:
```bash
cd frontend
npm install
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## Step 3: Access the Application

Open your browser and go to:
```
http://localhost:5173
```

## What You Should See:

1. **Landing Page** with upload zone
2. Upload a PDF file
3. Wait for processing (shows progress)
4. Chat interface appears automatically
5. Ask questions about your PDF!

## Troubleshooting

### Backend won't start?
- Make sure Ollama is running: `ollama serve`
- Check if port 8000 is free
- Verify all Python dependencies are installed

### Frontend won't start?
- Run `npm install` in the frontend directory
- Check if port 5173 is free
- Clear npm cache: `npm cache clean --force`

### Can't connect to backend?
- Verify backend is running on port 8000
- Check browser console for errors
- Verify proxy configuration in `vite.config.ts`

### PDF upload fails?
- Ensure the PDF is valid
- Check backend logs for errors
- Verify Docling is installed

## Features:

✅ Upload PDF
✅ Process with RAG engine (Docling + ChromaDB + Ollama)
✅ Chat with PDF
✅ View chat history
✅ Clear chat
✅ Upload new PDF
✅ 100% Offline operation

Enjoy your offline PDF chat! 🎉
