# DPR Analyzer

A FastAPI application that uses Google Gemini to extract structured JSON from DPR (Detailed Project Report) PDFs and provides a chat interface to interact with the documents.

## Features

- PDF upload and automatic JSON extraction using Gemini Files API
- Structured JSON output matching a predefined schema
- Chat interface with context-aware responses
- SQLite-based storage for DPRs and chat history
- Simple, clean web interface with dark theme

## Setup

### Prerequisites

- Python 3.8+
- Google Gemini API key

### Installation

1. Clone or extract the project:
```bash
cd dpr-analyzer
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the project root:
```bash
cp .env.example .env
```

5. Edit `.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
HOST=0.0.0.0
PORT=8000
```

Get your API key from: https://makersuite.google.com/app/apikey

6. Ensure the `data/` directory exists:
```bash
mkdir -p data
```

### Running the Application on LINUX OR WSL ONLY

```bash
chmod +x run.sh
./run.sh
```

Or manually:
```bash
source .env
uvicorn backend.app:app --reload --host $HOST --port $PORT
```

### Running the Application on WINDOWS

python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000



The application will be available at: http://localhost:8000

## Usage

1. **Upload a DPR PDF**: Click "Choose File" and select a PDF document
2. **Wait for Processing**: The system will upload to Gemini, extract structured data, and display the JSON
3. **Chat with the DPR**: Use the chat interface to ask questions about the uploaded document
4. **View Chat History**: Click "Load Chat History" to see previous conversations

## Architecture

- **Backend**: FastAPI with Python
- **AI/ML**: Google Gemini (gemini-1.5-flash)
- **Database**: SQLite
- **Frontend**: Vanilla JavaScript with minimal CSS

## API Endpoints

- `GET /` - Main web interface
- `POST /upload-dpr` - Upload and process a DPR PDF
- `GET /dpr/{dpr_id}` - Get DPR metadata and parsed JSON
- `POST /dpr/{dpr_id}/chat` - Send a chat message
- `GET /dpr/{dpr_id}/chat/history` - Get chat history

## Notes

- First upload takes 10-30 seconds as Gemini processes the PDF
- Chat responses reference specific pages/sections from the document
- All data is stored locally in `data/dpr.db` and `data/*.pdf`