import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from pydantic import BaseModel
from dotenv import load_dotenv

import backend.db as db
import backend.gemini_client as gemini_client

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="DPR Analyzer", version="1.0.0")

# Paths
DATA_DIR = Path("data")
SCHEMA_PATH = Path("backend/schema.json")

# Create data directory if it doesn't exist
DATA_DIR.mkdir(exist_ok=True)

# Initialize database
db.init_db(str(DATA_DIR / "dpr.db"))

# Mount static files and templates
app.mount("/static", StaticFiles(directory="backend/static"), name="static")
templates = Jinja2Templates(directory="backend/templates")


# Pydantic models for request/response
class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    sources: list
    message_id: int


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Serve the main web interface."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/upload-dpr")
async def upload_dpr(file: UploadFile = File(...)):
    """
    Upload a DPR PDF, process it with Gemini, and return structured JSON.
    
    Steps:
    1. Save the uploaded PDF to data/ directory
    2. Upload to Gemini Files API
    3. Generate JSON using Gemini with strict schema adherence
    4. Validate the JSON output
    5. Store in SQLite
    6. Return the parsed JSON
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    try:
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"{timestamp}_{unique_id}_{file.filename}"
        filepath = DATA_DIR / filename
        
        # Save the uploaded file
        print(f"⏳ Saving uploaded file: {filename}")
        with open(filepath, "wb") as f:
            content = await file.read()
            f.write(content)
        print(f"✓ File saved: {filepath} ({len(content)} bytes)")
        
        # Upload to Gemini Files API
        file_ref = gemini_client.upload_file(str(filepath))
        
        # Generate JSON from the file
        parsed_json = gemini_client.generate_json_from_file(file_ref, str(SCHEMA_PATH))
        
        # Store in database
        dpr_id = db.insert_dpr(
            filename=filename,
            filepath=str(filepath),
            file_ref=file_ref,
            summary_json=parsed_json
        )
        
        return JSONResponse({
            "dpr_id": dpr_id,
            "summary": parsed_json
        })
        
    except ValueError as e:
        # JSON validation or parsing error
        print(f"✗ Validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to parse valid JSON: {str(e)}")
    
    except Exception as e:
        print(f"✗ Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process DPR: {str(e)}")


@app.get("/dpr/{dpr_id}")
async def get_dpr(dpr_id: int):
    """
    Retrieve a stored DPR by ID.
    
    Returns the DPR metadata and parsed JSON.
    """
    dpr = db.get_dpr(dpr_id)
    
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    return JSONResponse(dpr)


@app.post("/dpr/{dpr_id}/chat")
async def chat_with_dpr(dpr_id: int, chat_message: ChatMessage):
    """
    Send a chat message about a DPR and get a response.
    
    The chat maintains context and references the uploaded PDF document.
    All messages are stored in SQLite for persistence.
    """
    # Verify DPR exists
    dpr = db.get_dpr(dpr_id)
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    try:
        # Store user message
        db.insert_message(dpr_id, "user", chat_message.message)
        
        # Get response from Gemini
        response = gemini_client.send_chat_message(
            dpr_id=dpr_id,
            message=chat_message.message,
            file_ref=dpr["uploaded_file_ref"]
        )
        
        # Store assistant message
        db.insert_message(dpr_id, "assistant", response['reply'])
        
        # Get the message ID (last inserted)
        messages = db.get_messages(dpr_id)
        message_id = messages[-1]['id'] if messages else 0
        
        return JSONResponse({
            "reply": response['reply'],
            "sources": response.get('sources', []),
            "message_id": message_id
        })
        
    except Exception as e:
        print(f"✗ Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.get("/dpr/{dpr_id}/chat/history")
async def get_chat_history(dpr_id: int):
    """
    Retrieve the complete chat history for a DPR.
    
    Returns a list of messages in chronological order.
    """
    # Verify DPR exists
    dpr = db.get_dpr(dpr_id)
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    messages = db.get_messages(dpr_id)
    
    return JSONResponse({
        "dpr_id": dpr_id,
        "messages": messages,
        "count": len(messages)
    })


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "service": "dpr-analyzer"}


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host=host, port=port)