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


# ===== PAGE ROUTES =====

@app.get("/", response_class=HTMLResponse)
async def home_page(request: Request):
    """Serve the landing/home page."""
    return templates.TemplateResponse("home.html", {"request": request})


@app.get("/dprs/list", response_class=HTMLResponse)
async def dprs_list_page(request: Request):
    """Serve the DPR list page."""
    return templates.TemplateResponse("list.html", {"request": request})


@app.get("/dpr/{dpr_id}/detail", response_class=HTMLResponse)
async def dpr_detail_page(request: Request, dpr_id: int):
    """Serve the DPR detail/analysis page."""
    return templates.TemplateResponse("detail.html", {"request": request})


# ===== API ROUTES =====

@app.get("/dprs")
async def list_all_dprs():
    """Get a list of all DPRs with metadata."""
    dprs = db.get_all_dprs()
    return JSONResponse({"dprs": dprs, "count": len(dprs)})


@app.post("/upload-dpr")
async def upload_dpr(file: UploadFile = File(...)):
    """
    Upload a DPR PDF, process it with Gemini, and return structured JSON.
    
    If a PDF with the same filename already exists, return the existing analysis.
    Otherwise, process the new PDF and store it.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    try:
        original_filename = file.filename
        
        # Check if this PDF already exists
        existing_dpr = db.get_dpr_by_filename(original_filename)
        if existing_dpr:
            print(f"✓ PDF already exists: {original_filename} (ID: {existing_dpr['id']})")
            return JSONResponse({
                "dpr_id": existing_dpr["id"],
                "summary": existing_dpr["summary_json"],
                "existing": True
            })
        
        # Generate unique filename for storage
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"{timestamp}_{unique_id}_{original_filename}"
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
            original_filename=original_filename,
            filepath=str(filepath),
            file_ref=file_ref,
            summary_json=parsed_json
        )
        
        return JSONResponse({
            "dpr_id": dpr_id,
            "summary": parsed_json,
            "existing": False
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


@app.delete("/dpr/{dpr_id}/chat")
async def clear_chat(dpr_id: int):
    """
    Clear all chat history for a DPR.
    """
    # Verify DPR exists
    dpr = db.get_dpr(dpr_id)
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    try:
        # Clear from database
        deleted_count = db.clear_chat_history(dpr_id)
        
        # Clear from in-memory cache
        gemini_client.clear_chat_session(dpr_id)
        
        return JSONResponse({
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Cleared {deleted_count} messages"
        })
    except Exception as e:
        print(f"✗ Clear chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear chat: {str(e)}")


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "service": "dpr-analyzer"}


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host=host, port=port)