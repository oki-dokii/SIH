import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from pydantic import BaseModel
from dotenv import load_dotenv
from weasyprint import HTML

import backend.db as db
import backend.gemini_client as gemini_client
import backend.report_generator as report_generator

# Load environment variables
load_dotenv()

# Paths
DATA_DIR = Path("data")
SCHEMA_PATH = Path("backend/schema.json")

# Create data directory if it doesn't exist
DATA_DIR.mkdir(exist_ok=True)

# Initialize database
db.init_db(str(DATA_DIR / "dpr.db"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    On startup, check for interrupted DPRs and resume processing in background.
    """
    import asyncio
    
    async def resume_processing():
        print("⏳ Checking for interrupted DPR processing...")
        # Run DB query in thread pool to avoid blocking
        processing_dprs = await asyncio.to_thread(db.get_processing_dprs)
        
        if not processing_dprs:
            print("✓ No interrupted DPRs found.")
            return
            
        print(f"⚠ Found {len(processing_dprs)} interrupted DPRs. Resuming processing...")
        
        for dpr in processing_dprs:
            dpr_id = dpr['id']
            filename = dpr['filename']
            file_ref = dpr['uploaded_file_ref']
            
            print(f"▶ Resuming analysis for DPR {dpr_id} ({filename})...")
            
            try:
                # Generate analysis (now async)
                multilang_json = await gemini_client.generate_multilang_json_from_file(file_ref, str(SCHEMA_PATH))
                
                # Default to English for the main summary_json
                parsed_json = multilang_json.get("en", multilang_json)
                
                # Update database (run in thread pool)
                await asyncio.to_thread(db.update_dpr, dpr_id, parsed_json, multilang_json)
                print(f"✓ Completed analysis for DPR {dpr_id}")
                
            except Exception as e:
                print(f"✗ Failed to resume analysis for DPR {dpr_id}: {str(e)}")
                # If file ref is invalid, we might need to re-upload, but keeping it simple for now
                if "404" in str(e) or "403" in str(e):
                     print(f"⚠ File reference might be expired. Consider re-uploading {filename}")

    # Start the background task
    asyncio.create_task(resume_processing())
    
    yield
    # Shutdown logic (if any) goes here


# Initialize FastAPI app with lifespan
app = FastAPI(title="DPR Analyzer", version="1.0.0", lifespan=lifespan)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="backend/static"), name="static")
app.mount("/data", StaticFiles(directory="data"), name="data")
templates = Jinja2Templates(directory="backend/templates")


# Pydantic models for request/response
class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    sources: list
    message_id: int

class CreateComparisonRequest(BaseModel):
    name: str
    dpr_ids: list[int]




class CreateProjectRequest(BaseModel):
    name: str
    state: str
    scheme: str
    sector: str


# ===== PROJECT API ROUTES =====

@app.get("/projects")
async def list_projects():
    """Get a list of all projects."""
    projects = db.get_projects()
    return JSONResponse({"projects": projects, "count": len(projects)})

@app.post("/projects")
async def create_project(request: CreateProjectRequest):
    """Create a new project."""
    try:
        project_id = db.create_project(request.name, request.state, request.scheme, request.sector)
        return JSONResponse({
            "id": project_id,
            "name": request.name,
            "message": "Project created successfully"
        })
    except Exception as e:
        print(f"✗ Create project error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")

@app.delete("/projects/{project_id}")
async def delete_project(project_id: int):
    """Delete a project."""
    try:
        success = db.delete_project(project_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        return JSONResponse({"message": "Project deleted successfully"})
    except Exception as e:
        print(f"✗ Delete project error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

@app.get("/projects/{project_id}")
async def get_project(project_id: int):
    """Get project details."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return JSONResponse(project)

@app.get("/projects/{project_id}/dprs")
async def get_project_dprs(project_id: int):
    """Get all DPRs for a specific project."""
    dprs = db.get_dprs_by_project(project_id)
    return JSONResponse({"dprs": dprs, "count": len(dprs)})


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

@app.get("/comparison-chat/{comparison_id}/detail", response_class=HTMLResponse)
async def comparison_detail_page(request: Request, comparison_id: int):
    """Serve the comparison chat page."""
    return templates.TemplateResponse("comparison.html", {"request": request})


@app.get("/comparisons", response_class=HTMLResponse)
async def comparisons_list_page(request: Request):
    """Serve the comparisons list page."""
    return templates.TemplateResponse("comparisons.html", {"request": request})



# ===== API ROUTES =====

@app.get("/dprs")
async def list_all_dprs():
    """Get a list of all DPRs with metadata."""
    dprs = db.get_all_dprs()
    return JSONResponse({"dprs": dprs, "count": len(dprs)})



@app.post("/upload-dpr")
async def upload_dpr(
    file: UploadFile = File(...), 
    language: str = Form("en"),
    project_id: Optional[int] = Form(None)
):
    """
    Upload a DPR PDF, process it with Gemini, and return structured JSON.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    try:
        original_filename = file.filename
        
        # Check if this PDF already exists
        existing_dpr = db.get_dpr_by_filename(original_filename)
        if existing_dpr:
            print(f"✓ PDF already exists: {original_filename} (ID: {existing_dpr['id']})")
            
            # Update project_id if provided and different
            if project_id is not None and existing_dpr.get('project_id') != project_id:
                print(f"⏳ Updating project association: DPR {existing_dpr['id']} → Project {project_id}")
                import sqlite3
                conn = sqlite3.connect(str(DATA_DIR / "dpr.db"))
                cursor = conn.cursor()
                cursor.execute("UPDATE dprs SET project_id = ? WHERE id = ?", (project_id, existing_dpr['id']))
                conn.commit()
                conn.close()
                print(f"✓ Project association updated")
            
            return JSONResponse({
                "id": existing_dpr["id"],
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
        file_ref = await gemini_client.upload_file(str(filepath))
        
        # Insert initial record into database with project_id
        print(f"⏳ Inserting initial DPR record for {filename}...")
        dpr_id = db.insert_dpr(
            filename=filename,
            original_filename=original_filename,
            filepath=str(filepath),
            file_ref=file_ref,
            summary_json=None,
            summary_json_multilang=None,
            project_id=project_id
        )
        
        # Generate analysis in background
        print("⏳ Generating analysis in multiple languages...")
        try:
            multilang_json = await gemini_client.generate_multilang_json_from_file(file_ref, str(SCHEMA_PATH))
            print(f"✓ Generated analysis in {len(multilang_json)} languages")
            
            parsed_json = multilang_json.get(language, multilang_json["en"])
            db.update_dpr(dpr_id, parsed_json, multilang_json)
            
            return JSONResponse({
                "id": dpr_id,
                "dpr_id": dpr_id,
                "summary": parsed_json,
                "existing": False
            })
        except Exception as e:
            print(f"✗ Analysis failed: {str(e)}")
            raise e
        
    except Exception as e:
        print(f"✗ Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process DPR: {str(e)}")


@app.post("/upload-dpr")
async def upload_dpr(file: UploadFile = File(...), language: str = Form("en")):
    """
    Upload a DPR PDF, process it with Gemini, and return structured JSON.
    
    If a PDF with the same filename already exists, return the existing analysis.
    Otherwise, process the new PDF and store it.
    
    Args:
        file: PDF file to upload
        language: "en" for English, "hi" for Hindi (default: "en")
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
                "id": existing_dpr["id"],
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
        
        # Upload to Gemini Files API (now async)
        file_ref = await gemini_client.upload_file(str(filepath))
        
        # Insert initial record into database (so it shows as "Processing")
        print(f"⏳ Inserting initial DPR record for {filename}...")
        dpr_id = db.insert_dpr(
            filename=filename,
            original_filename=original_filename,
            filepath=str(filepath),
            file_ref=file_ref,
            summary_json=None,  # Initially None -> Processing
            summary_json_multilang=None
        )
        
        # Generate JSON in multiple languages for future-proof multilingual support
        print("⏳ Generating analysis in multiple languages (English & Hindi)...")
        
        try:
            # Single call to get both English and Hindi analysis (now async)
            multilang_json = await gemini_client.generate_multilang_json_from_file(file_ref, str(SCHEMA_PATH))
            
            print(f"✓ Generated analysis in {len(multilang_json)} languages")
            
            # Use the requested language as the default summary_json for backward compatibility
            parsed_json = multilang_json.get(language, multilang_json["en"])
            
            # Update database with analysis results
            db.update_dpr(dpr_id, parsed_json, multilang_json)
            
            return JSONResponse({
                "id": dpr_id,
                "dpr_id": dpr_id,
                "summary": parsed_json,
                "existing": False
            })
            
        except Exception as e:
            print(f"✗ Analysis failed: {str(e)}")
            # Optional: db.delete_dpr(dpr_id)
            raise e
        
    except ValueError as e:
        # JSON validation or parsing error
        print(f"✗ Validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to parse valid JSON: {str(e)}")
    
    except Exception as e:
        print(f"✗ Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process DPR: {str(e)}")


@app.get("/dpr/{dpr_id}")
async def get_dpr(dpr_id: int, language: str = "en"):
    """
    Retrieve a stored DPR by ID.
    
    Returns the DPR metadata and parsed JSON in the requested language.
    
    Args:
        dpr_id: The DPR ID
        language: Language code ("en", "hi", etc.) - defaults to "en"
    """
    dpr = db.get_dpr(dpr_id)
    
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    # If multilang data exists, use the requested language version
    if dpr.get("summary_json_multilang"):
        import json
        multilang_data = json.loads(dpr["summary_json_multilang"]) if isinstance(dpr["summary_json_multilang"], str) else dpr["summary_json_multilang"]
        
        # Get the requested language version, fallback to English if not available
        if language in multilang_data:
            dpr["summary_json"] = multilang_data[language]
        elif "en" in multilang_data:
            dpr["summary_json"] = multilang_data["en"]
    
    return JSONResponse(dpr)


@app.delete("/dpr/{dpr_id}")
async def delete_dpr(dpr_id: int):
    """
    Delete a DPR and all associated data.
    """
    # Verify DPR exists
    dpr = db.get_dpr(dpr_id)
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    try:
        # Delete from database and get filepath
        filepath = db.delete_dpr(dpr_id)
        
        # Delete file from disk
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
                print(f"✓ Deleted file: {filepath}")
            except Exception as e:
                print(f"⚠ Failed to delete file {filepath}: {str(e)}")
        
        # Clear in-memory chat session
        gemini_client.clear_chat_session(dpr_id)
        
        return JSONResponse({
            "success": True,
            "message": f"Deleted DPR {dpr_id}"
        })
    except Exception as e:
        print(f"✗ Delete DPR error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete DPR: {str(e)}")


@app.get("/dpr/{dpr_id}/report")
async def generate_dpr_report(dpr_id: int):
    """
    Generate a comprehensive PDF report for a DPR with charts and analysis.
    
    Returns a PDF file with all sections: Overview, Financial Analysis, Timeline, Risk Assessment, Compliance.
    """
    try:
        # Get DPR data
        dpr = db.get_dpr(dpr_id)
        if not dpr:
            raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
        
        # Validate summary_json exists
        summary_json = dpr.get('summary_json')
        if not summary_json:
            raise HTTPException(
                status_code=422, 
                detail=f"DPR {dpr_id} has not been analyzed yet. Please wait for analysis to complete."
            )
        
        # Parse summary_json if it's a string
        if isinstance(summary_json, str):
            import json
            try:
                summary_json = json.loads(summary_json)
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=422,
                    detail=f"DPR {dpr_id} has invalid analysis data: {str(e)}"
                )
        
        # Ensure summary_json is a dict
        if not isinstance(summary_json, dict):
            raise HTTPException(
                status_code=422,
                detail=f"DPR {dpr_id} analysis data is in an unexpected format"
            )
        
        # Generate charts (with error handling inside)
        charts = report_generator.prepare_chart_data(summary_json)
        
        # Prepare template context with safe defaults
        context = {
            'dpr': summary_json,
            'charts': charts,
            'generated_date': datetime.now().strftime('%B %d, %Y at %I:%M %p')
        }
        
        # Render HTML template
        html_content = templates.get_template('reports/dpr_report.html').render(context)
        
        # Convert HTML to PDF
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        # Return PDF as response
        filename = f"DPR_Report_{dpr_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Report generation error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


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
        
        # Get response from Gemini (now async)
        response = await gemini_client.send_chat_message(
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




# ===== COMPARISON CHAT API ROUTES =====

@app.get("/comparison-chats")
async def list_comparison_chats():
    """Get a list of all comparison chats."""
    chats = db.get_all_comparison_chats()
    return JSONResponse({"comparisons": chats, "count": len(chats)})


@app.post("/comparison-chats")
async def create_comparison_chat(request: CreateComparisonRequest):
    """Create a new comparison chat with selected DPRs."""
    if len(request.dpr_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 DPRs required for comparison")
   
    try:
        dprs = []
        for dpr_id in request.dpr_ids:
            dpr = db.get_dpr(dpr_id)
            if not dpr:
                raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
            dprs.append(dpr)
        
        comparison_id = db.create_comparison_chat(request.name, request.dpr_ids)
        print(f"✓ Comparison chat created with ID: {comparison_id} ({len(request.dpr_ids)} PDFs)")
        
        return JSONResponse({
            "comparison_id": comparison_id,
            "name": request.name,
            "dpr_count": len(request.dpr_ids)
        })
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Create comparison error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create comparison: {str(e)}")


@app.get("/comparison-chat/{comparison_id}")
async def get_comparison_chat(comparison_id: int):
    """Retrieve a comparison chat with its associated DPRs."""
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    return JSONResponse(comparison)


@app.post("/comparison-chat/{comparison_id}/chat")
async def chat_with_comparison(comparison_id: int, chat_message: ChatMessage):
    """Send a chat message to a comparison and get a response."""
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    
    try:
        print(f"⏳ Processing comparison chat message for comparison {comparison_id}")
        db.insert_comparison_message(comparison_id, "user", chat_message.message)
        file_refs = [dpr["uploaded_file_ref"] for dpr in comparison["dprs"]]
        
        # Get response from Gemini (now async)
        response = await gemini_client.send_comparison_message(
            comparison_id=comparison_id, 
            message=chat_message.message, 
            file_refs=file_refs
        )
        
        db.insert_comparison_message(comparison_id, "assistant", response['reply'])
        messages = db.get_comparison_messages(comparison_id)
        message_id = messages[-1]['id'] if messages else 0
        return JSONResponse({"reply": response['reply'], "sources": response.get('sources', []), "message_id": message_id})
    except Exception as e:
        print(f"✗ Comparison chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Comparison chat failed: {str(e)}")


@app.get("/comparison-chat/{comparison_id}/chat/history")
async def get_comparison_chat_history(comparison_id: int):
    """Retrieve the complete chat history for a comparison."""
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    messages = db.get_comparison_messages(comparison_id)
    return JSONResponse({"comparison_id": comparison_id, "messages": messages, "count": len(messages)})


@app.delete("/comparison-chat/{comparison_id}/chat")
async def clear_comparison_chat(comparison_id: int):
    """Clear all chat history for a comparison."""
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    
    try:
        deleted_count = db.clear_comparison_history(comparison_id)
        gemini_client.clear_comparison_chat_session(comparison_id)
        return JSONResponse({"success": True, "deleted_count": deleted_count, "message": f"Cleared {deleted_count} messages"})
    except Exception as e:
        print(f"✗ Clear comparison chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear comparison chat: {str(e)}")


@app.delete("/comparison-chat/{comparison_id}")
async def delete_comparison_chat(comparison_id: int):
    """Delete a comparison chat and all its history."""
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    
    try:
        db.delete_comparison_chat(comparison_id)
        # Also clear from in-memory cache if exists
        gemini_client.clear_comparison_chat_session(comparison_id)
        return JSONResponse({"success": True, "message": f"Deleted comparison chat {comparison_id}"})
    except Exception as e:
        print(f"✗ Delete comparison chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete comparison chat: {str(e)}")


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "service": "dpr-analyzer"}


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    # Use 1 worker on Windows to avoid WinError 10022
    uvicorn.run(app, host=host, port=port)