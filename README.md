# DPR Analyzer

A multi-page FastAPI application that uses Google Gemini 2.5 Flash to extract structured JSON from DPR (Detailed Project Report) PDFs and provides an interactive chat interface to ask questions about the documents.

## ✨ Features

### Core Functionality
- **Multi-Page Interface**: Dedicated pages for home, DPR list, and detailed analysis
- **PDF Upload & Analysis**: Automatic JSON extraction using Gemini Files API
- **Duplicate Detection**: Checks if PDF already exists by filename to avoid re-processing
- **Structured JSON Output**: Extracts data matching a predefined schema with validation
- **Interactive Chat**: Context-aware Q&A about uploaded documents
- **Persistent Storage**: SQLite database for DPRs, analyses, and chat history
- **Chat Management**: View chat history and clear conversations per DPR

### User Experience
- Modern dark theme with gradient accents
- Responsive design for desktop and mobile
- Real-time loading states and progress indicators
- Auto-loading chat history on page navigation
- Navigation between pages (Home ← → List ← → Detail)

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

1. **Clone or extract the project:**
```bash
cd SIH-first
```

2. **Create a virtual environment (recommended):**
```bash
python -m venv .venv
.venv\Scripts\activate  # On Windows
# source .venv/bin/activate  # On Linux/Mac
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Create a `.env` file in the project root:**
```env
GEMINI_API_KEY=your_api_key_here
HOST=127.0.0.1
PORT=8000
```

5. **Ensure the `data/` directory exists:**
```bash
mkdir data
```

### Running the Application

**On Windows:**
```bash
python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
```

**On Linux/Mac:**
```bash
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

The application will be available at: **http://localhost:8000**

## 📖 Usage Guide

### 1. Upload a DPR
- Navigate to the **Home page** (http://localhost:8000)
- Click **"Choose PDF File"** and select a DPR document
- Click **"Analyze Document"** to process
- Wait 10-30 seconds for Gemini to analyze the PDF
- You'll be redirected to the analysis detail page

**Note:** If you upload a PDF with the same filename as a previously analyzed document, the system will return the existing analysis without re-processing.

### 2. View All DPRs
- From the home page, click **"View All Reports"**
- Browse all uploaded DPRs in a grid layout
- Each card shows:
  - Original filename
  - Upload date and time
  - Overall score (color-coded)
  - Recommendation status
  - Project name
- Click any card to view detailed analysis

### 3. Analyze a DPR
- On the detail page, view comprehensive analysis including:
  - Project overview (name, location, sector)
  - Assessment scores and recommendations
  - Financial analysis (costs, IRR, DSCR)
  - Timeline and milestones
  - Risk assessment
  - Scope and objectives
  - Compliance checks
  - Raw JSON viewer

### 4. Chat with a DPR
- Click **"Start Chat with Document"** on the detail page
- Ask questions about the uploaded PDF
- Chat history is automatically saved
- Responses reference specific pages/sections from the document
- Click **"Clear Chat"** to reset the conversation (with confirmation)

### 5. Navigate Between Pages
- Use navigation buttons to move between:
  - **Home** ← → **List** ← → **Detail**
- Chat history persists across navigation
- Return anytime to continue conversations

## 🏗️ Architecture

### Technology Stack
- **Backend**: FastAPI (Python)
- **AI/ML**: Google Gemini 2.5 Flash
- **Database**: SQLite
- **Frontend**: Vanilla JavaScript + CSS (no frameworks)

### Project Structure
```
SIH-first/
├── backend/
│   ├── app.py              # FastAPI routes and endpoints
│   ├── db.py               # Database operations
│   ├── gemini_client.py    # Gemini API integration
│   ├── schema.json         # JSON extraction schema
│   ├── static/
│   │   ├── styles.css      # Shared styles
│   │   ├── home.js         # Home page logic
│   │   ├── list.js         # List page logic
│   │   └── detail.js       # Detail page logic
│   └── templates/
│       ├── home.html       # Landing page
│       ├── list.html       # DPR list page
│       └── detail.html     # Analysis detail page
├── data/
│   ├── dpr.db              # SQLite database
│   └── *.pdf               # Uploaded PDFs
├── .env                    # Environment variables
├── requirements.txt        # Python dependencies
└── README.md              # This file
```

## 🔌 API Endpoints

### Page Routes
- `GET /` - Home/landing page
- `GET /dprs/list` - DPR list page
- `GET /dpr/{dpr_id}/detail` - Analysis detail page

### API Routes
- `GET /dprs` - Get all DPRs (JSON)
- `POST /upload-dpr` - Upload and process a DPR PDF
- `GET /dpr/{dpr_id}` - Get DPR metadata and parsed JSON
- `POST /dpr/{dpr_id}/chat` - Send a chat message
- `GET /dpr/{dpr_id}/chat/history` - Get chat history
- `DELETE /dpr/{dpr_id}/chat` - Clear chat history

## 💾 Database Schema

### DPRs Table
- `id` - Primary key
- `filename` - Timestamped storage filename
- `original_filename` - Original PDF name (for duplicate detection)
- `filepath` - Full path to PDF file
- `uploaded_file_ref` - Gemini API file reference
- `upload_ts` - Upload timestamp
- `summary_json` - Extracted analysis (JSON)

### Messages Table
- `id` - Primary key
- `dpr_id` - Foreign key to dprs table
- `role` - 'user' or 'assistant'
- `text` - Message content
- `timestamp` - Message timestamp

## 🎯 Key Features Explained

### Duplicate Detection
PDFs are identified by their original filename. If you upload a PDF with the same name as an existing one, the system:
1. Checks the database for matching `original_filename`
2. Returns the existing analysis immediately
3. Shows a notification that the PDF was already analyzed
4. No re-processing or API calls to Gemini

### Chat Persistence
- All chat messages stored in SQLite database
- Chat history automatically loaded when viewing a DPR
- Conversations resume where you left off
- Chat can be cleared per DPR with confirmation
- In-memory sessions cleared on chat reset

### Gemini Integration
- **Model**: gemini-2.5-flash (fast and cost-effective)
- **Files API**: Uploads PDFs to Gemini for processing
- **Structured Extraction**: Uses strict prompts to ensure valid JSON
- **Chat Context**: Maintains file reference for context-aware responses

## 📝 Notes

- First upload takes 10-30 seconds as Gemini processes the PDF
- Chat responses reference specific pages/sections from the document
- All data stored locally in `data/dpr.db` and `data/*.pdf`
- Database auto-created on first run
- Filename-based duplicate detection (perfect for local use)
- Server auto-reloads on code changes with `--reload` flag

## 🛠️ Development

### Running with Auto-Reload
```bash
python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
```

### Database Location
```
data/dpr.db
```

### Clearing Data
To start fresh, simply delete the database file:
```bash
del data\dpr.db  # Windows
rm data/dpr.db   # Linux/Mac
```
The database will be recreated on next startup.

## 📄 License

This is a hackathon project for local use.

## 🆘 Troubleshooting

### Issue: "Module not found" errors
**Solution:** Ensure virtual environment is activated and dependencies installed:
```bash
.venv\Scripts\activate
pip install -r requirements.txt
```

### Issue: "API key not found"
**Solution:** Check `.env` file exists and contains valid `GEMINI_API_KEY`

### Issue: Chat clear button not working
**Solution:** Ensure server restarted after latest code changes (auto-reload should handle this)

### Issue: Duplicate PDFs not detected
**Solution:** This feature uses exact filename matching. Ensure PDF names are identical.

## 🚀 Future Enhancements

- Search and filter on DPR list page
- Export analysis as PDF reports
- Batch upload multiple DPRs
- Compare multiple DPRs side-by-side
- User authentication
- Cloud deployment