# DPR Analyzer - Quick Start Guide

## 🚀 Project Overview

The DPR Analyzer is a FastAPI-based web application that uses Google Gemini AI to automatically extract structured information from Detailed Project Report (DPR) PDF documents. It provides:

- **Automated JSON Extraction**: Upload a PDF and get structured JSON matching a predefined schema
- **AI-Powered Chat**: Ask questions about the document and get context-aware responses
- **Persistent Storage**: All DPRs and chat history stored in SQLite
- **Beautiful UI**: Modern dark-themed interface with intuitive visualization

## 📋 Prerequisites

- Python 3.8 or higher
- Google Gemini API key (get it from https://makersuite.google.com/app/apikey)
- pip (Python package manager)

## 🛠️ Installation Steps

### 1. Extract the Project
```bash
cd dpr-analyzer
```

### 2. Create Virtual Environment (Recommended)
```bash
python -m venv venv

# On Linux/Mac:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
```bash
# Edit the .env file and add your Gemini API key:
nano .env  # or use any text editor
```

Update this line:
```
GEMINI_API_KEY=your_actual_api_key_here
```

### 5. Run the Application
```bash
./run.sh
```

Or manually:
```bash
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

### 6. Access the Application
Open your browser and go to:
```
http://localhost:8000
```

## 📖 How to Use

### Upload and Analyze a DPR

1. Click **"Choose PDF File"** button
2. Select a DPR PDF document from your computer
3. Click **"Analyze Document"**
4. Wait 10-30 seconds while the AI processes the document
5. View the structured JSON results with:
   - Project Overview
   - Financial Analysis
   - Timeline Analysis
   - Risk Assessment
   - Compliance Check
   - And more...

### Chat with the DPR

1. After uploading a DPR, click **"Start Chat with Document"**
2. Type your question in the chat input
3. Press Enter or click **"Send"**
4. Get AI-powered responses that reference specific sections/pages
5. Click **"Load History"** to see previous conversations

### Sample Questions to Ask

- "What is the total project cost?"
- "What are the major risks identified?"
- "What is the implementation timeline?"
- "Summarize the financial analysis"
- "What permits and compliance requirements are needed?"

## 📁 Project Structure

```
dpr-analyzer/
├── README.md                  # Main documentation
├── .env                       # Environment variables (add your API key here)
├── .env.example              # Template for .env
├── requirements.txt          # Python dependencies
├── .gitignore               # Git ignore rules
├── run.sh                   # Startup script
├── data/                    # Created at runtime
│   ├── dpr.db              # SQLite database
│   └── *.pdf               # Uploaded PDFs
├── backend/
│   ├── app.py              # FastAPI application & routes
│   ├── gemini_client.py    # Gemini API wrapper
│   ├── db.py               # SQLite database operations
│   ├── schema.json         # JSON schema for validation
│   ├── templates/
│   │   └── index.html      # Frontend HTML
│   └── static/
│       └── main.js         # Frontend JavaScript
```

## 🔧 Configuration

### Environment Variables (.env)

- `GEMINI_API_KEY`: Your Google Gemini API key (required)
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)

### JSON Schema

The application extracts information according to the schema defined in `backend/schema.json`. This includes:

- Project Name and Location
- Project Sector
- Executive Summary
- Overall Score and Recommendation
- Financial Analysis (costs, returns, IRR, DSCR)
- Timeline Analysis
- Scope and Objectives
- Risk Assessment
- Compliance Check

You can modify the schema to match your specific requirements.

## 🎨 Features

### Structured Data Extraction
- Automatically parses DPR PDFs into structured JSON
- Validates output against predefined schema
- Handles complex financial data and nested structures

### Intelligent Chat Interface
- Context-aware responses based on document content
- Cites specific pages/sections when available
- Maintains conversation history
- Persistent storage across sessions

### Beautiful UI
- Modern dark theme
- Responsive design
- Color-coded risk severity
- Score badges and visual indicators
- Collapsible raw JSON view

## 🔍 API Endpoints

- `GET /` - Main web interface
- `POST /upload-dpr` - Upload and process a PDF
- `GET /dpr/{dpr_id}` - Get DPR metadata and JSON
- `POST /dpr/{dpr_id}/chat` - Send a chat message
- `GET /dpr/{dpr_id}/chat/history` - Get chat history
- `GET /health` - Health check

## 💡 Tips

1. **Large PDFs**: Processing may take 20-30 seconds for large documents
2. **API Key**: Keep your Gemini API key secure and never commit it to version control
3. **Storage**: All data is stored locally in the `data/` directory
4. **Multiple DPRs**: You can upload and chat with multiple DPRs - each has a unique ID
5. **JSON Validation**: If extraction fails, check the error message and try re-uploading

## 🐛 Troubleshooting

### "GEMINI_API_KEY not set" error
- Make sure you've created a `.env` file (copy from `.env.example`)
- Add your actual API key to the `.env` file

### "Failed to parse valid JSON" error
- The PDF might not match the expected DPR format
- Check the error details for raw response
- The AI model may need a clearer document structure

### Connection errors
- Ensure you have internet connectivity (Gemini API requires internet)
- Check if the Gemini API is accessible in your region

### Port already in use
- Change the PORT in `.env` to a different value (e.g., 8001)

## 📚 Technology Stack

- **Backend**: FastAPI (Python web framework)
- **AI/ML**: Google Gemini (gemini-1.5-flash)
- **Database**: SQLite
- **Frontend**: Vanilla JavaScript + HTML + CSS
- **File Upload**: Python multipart
- **Environment**: python-dotenv

## 🔒 Security Notes

- Never share your `.env` file or Gemini API key
- The `.gitignore` file prevents accidental commits of sensitive data
- All uploaded PDFs are stored locally in the `data/` directory
- Consider implementing authentication for production use

## 📞 Support

For issues, questions, or contributions:
- Check the README.md for detailed documentation
- Review the code comments in each file
- Ensure all dependencies are installed correctly

## 🚦 Next Steps

After getting started:
1. Upload a sample DPR to test the system
2. Try asking various questions in the chat
3. Explore the JSON schema and customize it for your needs
4. Consider adding authentication or rate limiting for production
5. Deploy to a cloud platform if needed

Happy analyzing! 🎉