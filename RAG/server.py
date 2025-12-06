import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
from rag_engine import RAGEngine

# Paths
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# Initialize database
db.init_db(str(DATA_DIR / "chat.db"))

# Initialize RAG Engine
print("🤖 Initializing RAG Engine...")
rag_engine = RAGEngine()
print("✓ RAG Engine ready")

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
    description: Optional[str] = ""


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
        project_id = db.create_project(project.name, project.description, str(DATA_DIR / "chat.db"))
        
        return JSONResponse({
            "id": project_id,
            "name": project.name,
            "description": project.description,
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


# ===== PDF ENDPOINTS =====

@app.post("/api/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None)
):
    """
    Upload a PDF file, process it with RAG engine, and store chunks in database.
    
    Flow:
    1. Save PDF to disk
    2. Process with RAG engine (Docling + ChromaDB)
    3. Store chunks in database
    4. Store metadata in SQLite
    5. Return PDF ID and chunk count
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
        
        # Insert into database first to get PDF ID
        pdf_id = db.insert_pdf(
            filename=filename,
            original_filename=original_filename,
            filepath=str(filepath),
            project_id=project_id,
            num_chunks=None,
            db_path=str(DATA_DIR / "chat.db")
        )
        
        # Process PDF with RAG engine and store chunks
        print(f"⏳ Processing PDF with RAG engine...")
        try:
            # Clear previous database to ensure clean state for new PDF
            rag_engine.clear_database()
            
            # Process the PDF and store chunks in database
            num_chunks = rag_engine.process_and_store_chunks(pdf_id, str(filepath), str(DATA_DIR / "chat.db"))
            print(f"✓ PDF processed: {num_chunks} chunks created and stored")
            
        except Exception as e:
            # If processing fails, delete the saved file and database entry
            if filepath.exists():
                os.unlink(filepath)
            db.delete_pdf(pdf_id, str(DATA_DIR / "chat.db"))
            raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")
        
        print(f"✓ PDF uploaded successfully (ID: {pdf_id}, Project: {project_id})")
        
        return JSONResponse({
            "id": pdf_id,
            "filename": original_filename,
            "num_chunks": num_chunks,
            "project_id": project_id
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


@app.get("/api/pdf/{pdf_id}")
async def get_pdf_details(pdf_id: int):
    """
    Get details of a specific PDF.
    """
    pdf = db.get_pdf(pdf_id, str(DATA_DIR / "chat.db"))
    
    if not pdf:
        raise HTTPException(status_code=404, detail=f"PDF {pdf_id} not found")
    
    return JSONResponse(pdf)


@app.post("/api/pdf/{pdf_id}/chat")
async def chat_with_pdf(pdf_id: int, chat_message: ChatMessage):
    """
    Send a chat message about a PDF and get a response.
    
    Flow:
    1. Verify PDF exists
    2. Load chunks from DB if available (avoid reprocessing)
    3. Store user message
    4. Get response from RAG engine
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
        
        # Get response from RAG engine
        print(f"⏳ Processing chat message for PDF {pdf_id}")
        answer, sources = rag_engine.chat(chat_message.message)
        
        # Store assistant message
        db.insert_message(pdf_id, "assistant", answer, str(DATA_DIR / "chat.db"))
        
        print(f"✓ Chat response generated")
        
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
