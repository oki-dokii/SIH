import os
import uuid
import json
import threading
from queue import Queue
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
from rag_engine import RAGEngine
from sync_manager import SyncManager

# Paths
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# Initialize database
db.init_db(str(DATA_DIR / "chat.db"))

# Initialize RAG Engine
print("🤖 Initializing RAG Engine...")
rag_engine = RAGEngine()
print("✓ RAG Engine ready")

# Initialize Sync Manager (optional - only if cloud URL is configured)
CLOUD_BACKEND_URL = os.getenv("CLOUD_BACKEND_URL")
sync_manager = None

if CLOUD_BACKEND_URL:
    try:
        sync_manager = SyncManager(
            cloud_url=CLOUD_BACKEND_URL,
            db_path=str(DATA_DIR / "chat.db")
        )
        # Start auto-sync worker
        sync_manager.start_auto_sync()
        print(f"✅ Sync enabled with cloud: {CLOUD_BACKEND_URL}")
    except Exception as e:
        print(f"⚠️  Failed to initialize sync manager: {e}")
        sync_manager = None
else:
    print("ℹ️  Sync disabled (CLOUD_BACKEND_URL not set)")

# Global queue for sequential PDF processing
processing_queue = Queue()
processing_active = False
processing_lock = threading.Lock()

# Initialize FastAPI app
app = FastAPI(title="Offline PDF Chat", version="1.0.0")

# Add CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    sources: list


class ProjectCreate(BaseModel):
    name: str
    state: str
    scheme: str
    sector: str


# ===== BACKGROUND PROCESSING WORKER =====

def start_processing_worker():
    """Start the background worker thread if not already running"""
    global processing_active
    with processing_lock:
        if not processing_active:
            processing_active = True
            thread = threading.Thread(target=process_queue_worker, daemon=True)
            thread.start()
            print("🚀 Started background processing worker")


def process_queue_worker():
    """
    Worker thread that processes PDFs sequentially from the queue.
    Only parses and stores chunks - analysis is triggered manually.
    """
    global processing_active
    
    while not processing_queue.empty():
        pdf_id, filepath = processing_queue.get()
        
        try:
            print(f"⏳ Processing PDF {pdf_id} from queue...")
            
            # Update status to 'processing'
            db.update_pdf_status(pdf_id, 'processing', db_path=str(DATA_DIR / "chat.db"))
            
            # Clear vector database for new PDF
            rag_engine.clear_database()
            
            # Process chunks with RAG engine (PARSING ONLY - NO ANALYSIS)
            num_chunks = rag_engine.process_and_store_chunks(pdf_id, filepath, str(DATA_DIR / "chat.db"))
            print(f"✓ PDF {pdf_id}: {num_chunks} chunks processed and stored")
            
            # Update status to 'ready' (chunks stored, ready for analysis)
            db.update_pdf_status(pdf_id, 'ready', db_path=str(DATA_DIR / "chat.db"))
            print(f"✅ PDF {pdf_id}: Parsing completed - ready for analysis")
            
        except Exception as e:
            print(f"✗ PDF {pdf_id}: Processing failed - {str(e)}")
            db.update_pdf_status(pdf_id, 'failed', error_message=str(e), db_path=str(DATA_DIR / "chat.db"))
        
        finally:
            processing_queue.task_done()
    
    # All done
    with processing_lock:
        processing_active = False
    print("✓ Background worker finished - all PDFs processed")


# ===== API ROUTES =====

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "online", "message": "Offline PDF Chat API"}


# ===== PROJECT ENDPOINTS =====

@app.post("/api/projects")
async def create_project(project: ProjectCreate):
    """
    Create a new project.
    """
    try:
        project_id = db.create_project(
            project.name, 
            project.state,
            project.scheme,
            project.sector,
            str(DATA_DIR / "chat.db")
        )
        
        return JSONResponse({
            "id": project_id,
            "name": project.name,
            "state": project.state,
            "scheme": project.scheme,
            "sector": project.sector,
            "message": "Project created successfully"
        })
    except Exception as e:
        print(f"✗ Create project error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@app.get("/api/projects")
async def list_projects():
    """
    Get a list of all projects with PDF counts.
    """
    projects = db.get_all_projects(str(DATA_DIR / "chat.db"))
    return JSONResponse({"projects": projects, "count": len(projects)})


@app.get("/api/projects/{project_id}")
async def get_project(project_id: int):
    """
    Get project details including all PDFs in the project.
    """
    project = db.get_project(project_id, str(DATA_DIR / "chat.db"))
    
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    # Get PDFs for this project
    pdfs = db.get_project_pdfs(project_id, str(DATA_DIR / "chat.db"))
    
    return JSONResponse({
        **project,
        "pdfs": pdfs
    })


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int):
    """
    Delete a project and all associated PDFs.
    """
    # Verify project exists
    project = db.get_project(project_id, str(DATA_DIR / "chat.db"))
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    try:
        # Get PDFs to delete files from disk
        pdfs = db.get_project_pdfs(project_id, str(DATA_DIR / "chat.db"))
        
        # Delete from database
        db.delete_project(project_id, str(DATA_DIR / "chat.db"))
        
        # Delete PDF files from disk
        for pdf in pdfs:
            filepath = pdf.get("filepath")
            if filepath and os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    print(f"✓ Deleted file: {filepath}")
                except Exception as e:
                    print(f"⚠ Failed to delete file {filepath}: {str(e)}")
        
        # Clear RAG engine database
        rag_engine.clear_database()
        
        return JSONResponse({
            "success": True,
            "message": f"Deleted project {project_id} and {len(pdfs)} PDFs"
        })
    except Exception as e:
        print(f"✗ Delete project error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")


# ===== SYNC ENDPOINTS (ADMIN ONLY) =====

@app.post("/api/admin/sync")
async def manual_sync():
    """
    Manually trigger a full sync with cloud backend.
    Returns sync status and statistics.
    """
    if not sync_manager:
        raise HTTPException(
            status_code=503, 
            detail="Sync not configured. Set CLOUD_BACKEND_URL environment variable."
        )
    
    try:
        # Check connectivity
        is_online = sync_manager.check_connection()
        
        if not is_online:
            return JSONResponse({
                "success": False,
                "message": "Cloud backend is offline",
                "is_online": False
            })
        
        # Perform sync
        sync_manager.full_sync()
        
        return JSONResponse({
            "success": True,
            "message": "Sync completed successfully",
            "is_online": True,
            "cloud_url": sync_manager.cloud_url
        })
        
    except Exception as e:
        print(f"✗ Manual sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@app.get("/api/admin/sync/status")
async def sync_status():
    """
    Get current sync status and configuration.
    """
    if not sync_manager:
        return JSONResponse({
            "enabled": False,
            "message": "Sync not configured"
        })
    
    is_online = sync_manager.check_connection()
    
    return JSONResponse({
        "enabled": True,
        "is_online": is_online,
        "cloud_url": sync_manager.cloud_url,
        "sync_interval": sync_manager.sync_interval,
        "auto_sync_running": sync_manager.running
    })


# ===== PDF ENDPOINTS =====

@app.post("/api/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None)
):
    """
    Upload a PDF file and queue it for background processing.
    Returns immediately with status='pending'.
    
    Flow:
    1. Save PDF to disk
    2. Insert record with status='pending'
    3. Add to processing queue
    4. Start worker if needed
    5. Return immediately (non-blocking)
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    # Use default project if none specified
    if project_id is None:
        project_id = 1  # Default "Uncategorized" project
    
    # Verify project exists
    project = db.get_project(project_id, str(DATA_DIR / "chat.db"))
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    try:
        original_filename = file.filename
        
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
        
        # Insert into database with status='pending'
        # Note: New PDFs are automatically marked as dirty=1 for sync
        pdf_id = db.insert_pdf(
            filename=filename,
            original_filename=original_filename,
            filepath=str(filepath),
            project_id=project_id,
            num_chunks=None,
            db_path=str(DATA_DIR / "chat.db")
        )
        
        # Set initial status to 'pending'
        db.update_pdf_status(pdf_id, 'pending', db_path=str(DATA_DIR / "chat.db"))
        
        # Add to processing queue
        processing_queue.put((pdf_id, str(filepath)))
        print(f"✓ PDF {pdf_id} added to processing queue")
        
        # Start background worker if not running
        start_processing_worker()
        
        # Return immediately - processing happens in background
        print(f"✓ PDF uploaded successfully (ID: {pdf_id}, Status: pending)")
        
        return JSONResponse({
            "id": pdf_id,
            "filename": original_filename,
            "project_id": project_id,
            "status": "pending",
            "message": "PDF uploaded successfully and queued for processing"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload PDF: {str(e)}")


@app.get("/api/pdfs")
async def list_pdfs(project_id: Optional[int] = None):
    """
    Get a list of all uploaded PDFs with metadata.
    Optionally filter by project_id.
    """
    pdfs = db.get_all_pdfs(project_id, str(DATA_DIR / "chat.db"))
    return JSONResponse({"pdfs": pdfs, "count": len(pdfs)})


@app.post("/api/pdf/{pdf_id}/analyze")
async def analyze_pdf(pdf_id: int):
    """
    Trigger offline analysis for a PDF that has been parsed and has chunks stored.
    This is called manually by the user via the "Analyze DPR Offline" button.
    """
    # Get PDF info
    pdf = db.get_pdf(pdf_id, str(DATA_DIR / "chat.db"))
    if not pdf:
        raise HTTPException(status_code=404, detail=f"PDF {pdf_id} not found")
    
    # Check if chunks are stored
    if not pdf.get('chunks_stored'):
        raise HTTPException(status_code=400, detail="PDF has not been parsed yet. Please wait for parsing to complete.")
    
    # Check if already analyzed
    if pdf.get('sectional_analysis'):
        raise HTTPException(status_code=400, detail="PDF has already been analyzed")
    
    try:
        print(f"⏳ Starting offline analysis for PDF {pdf_id}...")
        
        # Update status to 'analyzing'
        db.update_pdf_status(pdf_id, 'analyzing', db_path=str(DATA_DIR / "chat.db"))
        
        # Run sectional analysis
        analysis_result = rag_engine.generate_sectional_analysis(pdf_id, str(DATA_DIR / "chat.db"))
        
        # Store analysis
        analysis_json = json.dumps(analysis_result)
        db.update_pdf_analysis(pdf_id, analysis_json, str(DATA_DIR / "chat.db"))
        
        # Update status to 'completed'
        db.update_pdf_status(pdf_id, 'completed', db_path=str(DATA_DIR / "chat.db"))
        
        print(f"✅ PDF {pdf_id}: Analysis completed successfully")
        
        return JSONResponse({
            "id": pdf_id,
            "status": "completed",
            "message": "Analysis completed successfully",
            "analysis": analysis_result
        })
        
    except Exception as e:
        print(f"✗ PDF {pdf_id}: Analysis failed - {str(e)}")
        db.update_pdf_status(pdf_id, 'analysis_failed', error_message=str(e), db_path=str(DATA_DIR / "chat.db"))
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/api/pdf/{pdf_id}")
async def get_pdf_details(pdf_id: int):
    """
    Get details of a specific PDF.
    """
    pdf = db.get_pdf(pdf_id, str(DATA_DIR / "chat.db"))
    
    if not pdf:
        raise HTTPException(status_code=404, detail=f"PDF {pdf_id} not found")
    
    return JSONResponse(pdf)


@app.get("/api/pdf/{pdf_id}/analysis")
async def get_pdf_analysis(pdf_id: int):
    """
    Get the sectional analysis for a PDF.
    Returns the complete analysis JSON ready for frontend display.
    """
    # Verify PDF exists
    pdf = db.get_pdf(pdf_id, str(DATA_DIR / "chat.db"))
    if not pdf:
        raise HTTPException(status_code=404, detail=f"PDF {pdf_id} not found")
    
    # Get analysis
    analysis = db.get_pdf_analysis(pdf_id, str(DATA_DIR / "chat.db"))
    
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Analysis not found for PDF {pdf_id}")
    
    return JSONResponse(analysis)


@app.post("/api/pdf/{pdf_id}/chat")
async def chat_with_pdf(pdf_id: int, chat_message: ChatMessage):
    """
    Send a chat message about a PDF and get a response.
    
    Flow:
    1. Verify PDF exists
    2. Load chunks from DB if available (avoid reprocessing)
    3. Store user message
    4. Get response from RAG engine (conversational mode)
    5. Store assistant message
    6. Return response
    """
    # Verify PDF exists
    pdf = db.get_pdf(pdf_id, str(DATA_DIR / "chat.db"))
    if not pdf:
        raise HTTPException(status_code=404, detail=f"PDF {pdf_id} not found")
    
    try:
        # Check if chunks are stored in database
        if pdf.get("chunks_stored"):
            # Load from database instead of reprocessing
            print(f"⏳ Loading chunks from database for PDF {pdf_id}")
            rag_engine.clear_database()  # Clear previous PDF data
            rag_engine.load_chunks_from_db(pdf_id, str(DATA_DIR / "chat.db"))
        else:
            # Fallback: chunks not stored, need to process PDF
            print(f"⚠️  Chunks not stored for PDF {pdf_id}, processing now...")
            rag_engine.clear_database()
            num_chunks = rag_engine.process_and_store_chunks(pdf_id, pdf["filepath"], str(DATA_DIR / "chat.db"))
            print(f"✓ Processed and stored {num_chunks} chunks")
        
        # Store user message
        db.insert_message(pdf_id, "user", chat_message.message, str(DATA_DIR / "chat.db"))
        
        # Get response from RAG engine in CONVERSATIONAL mode (not JSON)
        print(f"⏳ Processing chat message for PDF {pdf_id}")
        answer, sources = rag_engine.chat(chat_message.message, json_mode=False)
        
        # Store assistant message
        db.insert_message(pdf_id, "assistant", answer, str(DATA_DIR / "chat.db"))
        
        print(f"✓ Chat response generated for PDF {pdf_id} successfully")
        
        return JSONResponse({
            "reply": answer,
            "sources": sources if sources else []
        })
        
    except Exception as e:
        print(f"✗ Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.get("/api/pdf/{pdf_id}/messages")
async def get_chat_history(pdf_id: int):
    """
    Retrieve the complete chat history for a PDF.
    """
    # Verify PDF exists
    pdf = db.get_pdf(pdf_id, str(DATA_DIR / "chat.db"))
    if not pdf:
        raise HTTPException(status_code=404, detail=f"PDF {pdf_id} not found")
    
    messages = db.get_messages(pdf_id, str(DATA_DIR / "chat.db"))
    
    return JSONResponse({
        "pdf_id": pdf_id,
        "messages": messages,
        "count": len(messages)
    })


@app.delete("/api/pdf/{pdf_id}/messages")
async def clear_chat(pdf_id: int):
    """
    Clear all chat history for a PDF.
    """
    # Verify PDF exists
    pdf = db.get_pdf(pdf_id, str(DATA_DIR / "chat.db"))
    if not pdf:
        raise HTTPException(status_code=404, detail=f"PDF {pdf_id} not found")
    
    try:
        # Clear from database
        deleted_count = db.clear_chat_history(pdf_id, str(DATA_DIR / "chat.db"))
        
        print(f"✓ Cleared {deleted_count} messages for PDF {pdf_id}")
        
        return JSONResponse({
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Cleared {deleted_count} messages"
        })
    except Exception as e:
        print(f"✗ Clear chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear chat: {str(e)}")


@app.delete("/api/pdf/{pdf_id}")
async def delete_pdf(pdf_id: int):
    """
    Delete a PDF and all associated data (chunks, messages).
    
    Flow:
    1. Delete from database (also deletes chunks and messages via CASCADE)
    2. Delete file from disk
    3. Clear RAG engine database
    """
    # Verify PDF exists
    pdf = db.get_pdf(pdf_id, str(DATA_DIR / "chat.db"))
    if not pdf:
        raise HTTPException(status_code=404, detail=f"PDF {pdf_id} not found")
    
    try:
        # Delete from database and get filepath (CASCADE deletes chunks and messages)
        filepath = db.delete_pdf(pdf_id, str(DATA_DIR / "chat.db"))
        
        # Delete file from disk
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
                print(f"✓ Deleted file: {filepath}")
            except Exception as e:
                print(f"⚠ Failed to delete file {filepath}: {str(e)}")
        
        # Clear RAG engine database
        rag_engine.clear_database()
        
        return JSONResponse({
            "success": True,
            "message": f"Deleted PDF {pdf_id}"
        })
    except Exception as e:
        print(f"✗ Delete PDF error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete PDF: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
