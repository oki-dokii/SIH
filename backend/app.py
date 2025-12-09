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
from fastapi.middleware.cors import CORSMiddleware
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
            filepath = dpr['filepath']
            
            print(f"▶ Resuming analysis for DPR {dpr_id} ({filename})...")
            
            try:
                # Generate analysis (now async)
                parsed_json = await gemini_client.generate_json_from_file(file_ref, str(SCHEMA_PATH))
                
                # Update database (run in thread pool)
                await asyncio.to_thread(db.update_dpr, dpr_id, parsed_json)
                print(f"✓ Completed analysis for DPR {dpr_id}")
                
            except Exception as e:
                error_str = str(e)
                print(f"✗ Failed to resume analysis for DPR {dpr_id}: {error_str}")
                
                # Handle expired file URL
                if "404" in error_str or "403" in error_str or "expired" in error_str.lower():
                    print(f"⚠ File reference expired for DPR {dpr_id}. Re-uploading PDF...")
                    
                    try:
                        # Check if the original file still exists on disk
                        if not os.path.exists(filepath):
                            print(f"✗ Original file not found: {filepath}. Skipping DPR {dpr_id}.")
                            continue
                        
                        # Re-upload the PDF to Gemini
                        new_file_ref = await gemini_client.upload_file(filepath)
                        print(f"✓ Re-uploaded file. New reference: {new_file_ref}")
                        
                        # Update database with new file reference
                        await asyncio.to_thread(db.update_dpr_file_ref, dpr_id, new_file_ref)
                        print(f"✓ Updated database with new file reference")
                        
                        # Retry analysis with new file reference
                        print(f"↺ Retrying analysis for DPR {dpr_id}...")
                        parsed_json = await gemini_client.generate_json_from_file(new_file_ref, str(SCHEMA_PATH))
                        
                        # Update database with analysis results
                        await asyncio.to_thread(db.update_dpr, dpr_id, parsed_json)
                        print(f"✓ Completed analysis for DPR {dpr_id} after re-upload")
                        
                    except Exception as retry_error:
                        print(f"✗ Failed to re-upload and analyze DPR {dpr_id}: {str(retry_error)}")
                        # Leave the DPR in processing state for manual intervention
                else:
                    # For other errors, just log and continue
                    print(f"⚠ Leaving DPR {dpr_id} in processing state for manual review")

    # Start the background task
    asyncio.create_task(resume_processing())
    
    yield
    # Shutdown logic (if any) goes here


# Initialize FastAPI app with lifespan
app = FastAPI(title="DPR Analyzer", version="1.0.0", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://127.0.0.1:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],
)

DATA_DIR.mkdir(exist_ok=True)

# Initialize database
db.init_db(str(DATA_DIR / "dpr.db"))


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


class UpdateComplianceWeightsRequest(BaseModel):
    weights: dict
    recalculate: bool = False



class AdminLoginRequest(BaseModel):
    admin_id: str
    password: str


class AdminLoginResponse(BaseModel):
    success: bool
    message: str


class UserRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    confirm_password: str


class UserLoginRequest(BaseModel):
    email: str
    password: str


class UserAuthResponse(BaseModel):
    success: bool
    message: str
    user: dict = None


# ===== ADMIN AUTH API ROUTES =====

@app.post("/api/admin/login")
async def admin_login(request: AdminLoginRequest):
    """Authenticate admin user with credentials from environment variables."""
    admin_id = os.getenv("ADMIN_ID")
    admin_password = os.getenv("ADMIN_PASSWORD")
    
    if not admin_id or not admin_password:
        raise HTTPException(status_code=500, detail="Admin credentials not configured")
    
    if request.admin_id == admin_id and request.password == admin_password:
        return JSONResponse({
            "success": True,
            "message": "Login successful"
        })
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")


# ===== USER AUTH API ROUTES =====

@app.post("/api/user/register")
async def user_register(request: UserRegisterRequest):
    """Register a new user account."""
    # Validate password match
    if request.password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    # Validate password length
    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    
    # Validate email format (basic check)
    if '@' not in request.email or '.' not in request.email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    try:
        # Store password as plain text
        password_hash = request.password
        
        # Create user in database
        user_id = db.create_user(request.email, password_hash, request.name)
        
        return JSONResponse({
            "success": True,
            "message": "Registration successful",
            "user": {
                "id": user_id,
                "name": request.name,
                "email": request.email
            }
        })
    except ValueError as e:
        # Handle duplicate email
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"✗ Registration error: {str(e)}")
        print(f"✗ Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        # Return the actual error message
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@app.post("/api/user/login")
async def user_login(request: UserLoginRequest):
    """Authenticate user with username/email and password."""
    try:
        # Get user by email
        user = db.get_user_by_email(request.email)
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Verify password (plain text comparison)
        if request.password != user["password_hash"]:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Return success with user info (excluding password hash)
        return JSONResponse({
            "success": True,
            "message": "Login successful",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"]
            }
        })
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")


# ===== CLIENT DPR API ROUTES =====

@app.post("/api/client/dprs/upload")
async def client_upload_dpr(
    client_id: int = Form(...),
    project_id: int = Form(...),
    project_name: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload a DPR PDF for a specific client. Creates an unanalyzed DPR that admin can analyze later."""
    # Validate inputs
    if not project_name or not project_name.strip():
        raise HTTPException(status_code=400, detail="Project name is required")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Check if client already has a DPR for this project
        import sqlite3
        conn = sqlite3.connect(str(DATA_DIR / "dpr.db"))
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id FROM dprs 
            WHERE project_id = ? AND client_id = ?
        """, (project_id, client_id))
        existing_dpr = cursor.fetchone()
        conn.close()
        
        if existing_dpr:
            raise HTTPException(
                status_code=400, 
                detail="You have already uploaded a DPR for this project. Only one DPR per project is allowed."
            )
        
        original_filename = file.filename
        
        # Generate unique filename for storage (same as admin uploads)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"{timestamp}_{unique_id}_{original_filename}"
        filepath = DATA_DIR / filename
        
        # Save the uploaded file to data/ directory
        print(f"⏳ Saving client DPR: {filename}")
        with open(filepath, "wb") as f:
            content = await file.read()
            f.write(content)
        print(f"✓ File saved: {filepath} ({len(content)} bytes)")
        
        # Upload to Gemini Files API for future analysis
        file_ref = await gemini_client.upload_file(str(filepath))
        
        # Insert record into dprs table WITHOUT analysis initially
        print(f"⏳ Inserting client DPR record for {filename}...")
        dpr_id = db.insert_dpr(
            filename=filename,
            original_filename=original_filename,
            filepath=str(filepath),
            file_ref=file_ref,
            summary_json=None,  # Will be populated after analysis
            project_id=project_id
        )
        
        # Update the record with client_id and set status to 'analyzing'
        conn = sqlite3.connect(str(DATA_DIR / "dpr.db"))
        cursor = conn.cursor()
        cursor.execute("UPDATE dprs SET client_id = ?, status = 'analyzing' WHERE id = ?", (client_id, dpr_id))
        conn.commit()
        conn.close()
        
        # Automatically analyze the DPR
        try:
            print(f"⏳ Auto-analyzing client DPR {dpr_id}...")
            parsed_json = await gemini_client.generate_json_from_file(file_ref, str(SCHEMA_PATH))
            print(f"✓ Analysis complete for DPR {dpr_id}")
            
            # Validate DPR against project
            validation_flags = db.validate_dpr_against_project(dpr_id, project_id, parsed_json)
            if validation_flags.get('hasFlags'):
                print(f"⚠ DPR {dpr_id} has validation flags: {len(validation_flags['flags'])} issue(s)")
            
            # Update database with analysis results and validation flags
            db.update_dpr(dpr_id, parsed_json, validation_flags)
            
            conn = sqlite3.connect(str(DATA_DIR / "dpr.db"))
            cursor = conn.cursor()
            cursor.execute("UPDATE dprs SET status = 'completed' WHERE id = ?", (dpr_id,))
            conn.commit()
            conn.close()
            
            return JSONResponse({
                "success": True,
                "message": "DPR uploaded and analyzed successfully!",
                "dpr_id": dpr_id,
                "analyzed": True
            })
            
        except Exception as analysis_error:
            # If analysis fails, set status to 'pending' so admin can retry
            print(f"✗ Auto-analysis failed for DPR {dpr_id}: {str(analysis_error)}")
            
            conn = sqlite3.connect(str(DATA_DIR / "dpr.db"))
            cursor = conn.cursor()
            cursor.execute("UPDATE dprs SET status = 'pending' WHERE id = ?", (dpr_id,))
            conn.commit()
            conn.close()
            
            # Still return success for upload, but note analysis failed
            return JSONResponse({
                "success": True,
                "message": "DPR uploaded successfully, but analysis failed. An admin can analyze it later.",
                "dpr_id": dpr_id,
                "analyzed": False,
                "analysis_error": str(analysis_error)
            })
    
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Client DPR upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload DPR: {str(e)}")




@app.get("/api/client/dprs")
async def get_client_dprs_list(client_id: int):
    """Get all DPRs for a specific client from the main dprs table."""
    try:
        import sqlite3
        conn = sqlite3.connect(str(DATA_DIR / "dpr.db"))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT d.id, d.project_id, d.client_id, d.original_filename, 
                   d.filename as dpr_filename,
                   d.upload_ts as created_at, d.status,
                   d.admin_feedback, d.feedback_timestamp,
                   p.name as project_name
            FROM dprs d
            LEFT JOIN projects p ON d.project_id = p.id
            WHERE d.client_id = ?
            ORDER BY d.upload_ts DESC
        """, (client_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        dprs = [dict(row) for row in rows]
        return JSONResponse({"dprs": dprs, "count": len(dprs)})
    except Exception as e:
        print(f"✗ Get client DPRs error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve DPRs: {str(e)}")




@app.get("/api/client/dprs/{dpr_id}/download")
async def download_client_dpr(dpr_id: int, client_id: int):
    """Download a client's DPR PDF."""
    try:
        # Get DPR record
        dpr = db.get_client_dpr(dpr_id)
        if not dpr:
            raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
        
        # Security check: ensure the DPR belongs to the requesting client
        if dpr["client_id"] != client_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Construct file path
        filepath = Path("uploads") / str(client_id) / dpr["dpr_filename"]
        
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="File not found on server")
        
        # Read file and return
        with open(filepath, "rb") as f:
            content = f.read()
        
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={dpr['original_filename']}"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Download client DPR error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download DPR: {str(e)}")


@app.delete("/api/client/dprs/{dpr_id}")
async def delete_client_dpr(dpr_id: int, client_id: int):
    """Delete a client's DPR. Allows client to upload a new DPR to that project."""
    try:
        # Get DPR record
        dpr = db.get_dpr(dpr_id)
        if not dpr:
            raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
        
        # Debug logging
        print(f"DEBUG: DPR data: {dpr}")
        print(f"DEBUG: dpr.get('client_id') = {dpr.get('client_id')} (type: {type(dpr.get('client_id'))})")
        print(f"DEBUG: client_id parameter = {client_id} (type: {type(client_id)})")
        
        # Security check: ensure the DPR belongs to the requesting client
        if dpr.get("client_id") != client_id:
            print(f"✗ Access denied: DPR client_id={dpr.get('client_id')}, request client_id={client_id}")
            raise HTTPException(status_code=403, detail="Access denied. You can only delete your own DPRs.")
        
        # Delete the file
        filepath = Path(dpr["filepath"])
        if filepath.exists():
            filepath.unlink()
            print(f"✓ Deleted file: {filepath}")
        
        # Delete database record
        db.delete_dpr(dpr_id)
        print(f"✓ Deleted DPR record: {dpr_id}")
        
        return JSONResponse({
            "success": True,
            "message": "DPR deleted successfully. You can now upload a new DPR to this project."
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Delete client DPR error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete DPR: {str(e)}")



# ===== DPR FEEDBACK API ROUTE =====

@app.put("/dprs/{dpr_id}/feedback")
async def update_dpr_feedback_endpoint(dpr_id: int, feedback: str = Form(...)):
    """Admin endpoint to add/update feedback for a DPR."""
    try:
        # Check if DPR exists
        dpr = db.get_dpr(dpr_id)
        if not dpr:
            raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
        
        # Update feedback
        db.update_dpr_feedback(dpr_id, feedback)
        
        return JSONResponse({
            "success": True,
            "message": "Feedback updated successfully"
        })
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Update feedback error: {str(e)}") 
        raise HTTPException(status_code=500, detail=f"Failed to update feedback: {str(e)}")


@app.put("/dprs/{dpr_id}/status")
async def update_dpr_status_endpoint(dpr_id: int, status: str = Form(...)):
    """Admin endpoint to update DPR status (accepted, rejected, pending)."""
    try:
        # Validate status
        valid_statuses = ['pending', 'accepted', 'rejected', 'completed', 'analyzing']
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        # Check if DPR exists
        dpr = db.get_dpr(dpr_id)
        if not dpr:
            raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
        
        # Update status
        db.update_dpr_status(dpr_id, status)
        
        return JSONResponse({
            "success": True,
            "message": f"DPR status updated to '{status}' successfully"
        })
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Update status error: {str(e)}") 
        raise HTTPException(status_code=500, detail=f"Failed to update status: {str(e)}")



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


@app.post("/projects/{project_id}/compare-all")
async def compare_all_project_dprs(project_id: int):
    """
    Compare all DPRs in a project and recommend the best one.
    Uses Gemini AI to analyze all DPR summaries and provide a detailed comparison.
    Saves the result to the database.
    """
    # Get all DPRs for the project
    dprs = db.get_dprs_by_project(project_id)
    
    if not dprs:
        raise HTTPException(status_code=404, detail="No DPRs found in this project")
    
    # Filter to only analyzed DPRs (those with summary_json)
    analyzed_dprs = [dpr for dpr in dprs if dpr.get('summary_json')]
    
    if len(analyzed_dprs) < 2:
        raise HTTPException(
            status_code=400, 
            detail=f"Need at least 2 analyzed DPRs to compare. Found {len(analyzed_dprs)} analyzed DPRs."
        )
    
    # Compare using Gemini
    result = await gemini_client.compare_all_dprs(analyzed_dprs)
    
    if not result.get('success'):
        raise HTTPException(status_code=500, detail=result.get('error', 'Comparison failed'))
    
    # Save comparison result to database
    db.save_project_comparison(project_id, result['comparison'])
    
    return JSONResponse({
        "success": True,
        "comparison": result['comparison'],
        "saved": True
    })


@app.get("/projects/{project_id}/comparison")
async def get_project_comparison(project_id: int):
    """
    Retrieve saved comparison result for a project.
    """
    comparison_data = db.get_project_comparison(project_id)
    
    if not comparison_data:
        raise HTTPException(status_code=404, detail="No saved comparison found for this project")
    
    return JSONResponse({
        "success": True,
        "comparison": comparison_data["comparison"],
        "generated_at": comparison_data["generated_at"]
    })


@app.delete("/projects/{project_id}/comparison")
async def clear_project_comparison(project_id: int):
    """
    Clear/reset saved comparison result for a project.
    """
    db.clear_project_comparison(project_id)
    
    return JSONResponse({
        "success": True,
        "message": "Comparison cleared successfully"
    })


# ===== COMPLIANCE WEIGHTS API ROUTES =====

@app.get("/projects/{project_id}/compliance-weights")
async def get_compliance_weights(project_id: int):
    """
    Get compliance scoring weights for a project.
    Returns project-specific weights or defaults if not set.
    """
    import backend.compliance_calculator as compliance_calc
    
    try:
        # Verify project exists
        project = db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        # Get weights (will fall back to defaults if not set)
        weights = compliance_calc.get_project_weights(project_id)
        
        return JSONResponse({
            "success": True,
            "weights": weights,
            "isCustom": project.get("compliance_weights") is not None
        })
    except Exception as e:
        print(f"✗ Get compliance weights error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get compliance weights: {str(e)}")


@app.put("/projects/{project_id}/compliance-weights")
async def update_compliance_weights(project_id: int, request: UpdateComplianceWeightsRequest):
    """
    Update compliance scoring weights for a project.
    Optionally recalculates all DPR scores in the project with new weights.
    """
    import backend.compliance_calculator as compliance_calc
    
    try:
        # Verify project exists
        project = db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        # Validate weights
        is_valid, error_msg = compliance_calc.validate_weights(request.weights)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid weights: {error_msg}")
        
        # Update project weights
        success = compliance_calc.update_project_weights(project_id, request.weights)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update project weights")
        
        result = {
            "success": True,
            "message": "Weights updated successfully",
            "weights": request.weights
        }
        
        # Recalculate DPR scores if requested
        if request.recalculate:
            print(f"⏳ Recalculating compliance scores for project {project_id}...")
            count_updated, failed_ids = compliance_calc.recalculate_project_dprs(
                project_id, 
                request.weights
            )
            
            result["recalculated"] = True
            result["dprs_updated"] = count_updated
            result["dprs_failed"] = len(failed_ids)
            
            if failed_ids:
                result["failed_dpr_ids"] = failed_ids
                print(f"⚠ Failed to recalculate {len(failed_ids)} DPRs: {failed_ids}")
        else:
            result["recalculated"] = False
        
        return JSONResponse(result)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Update compliance weights error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update compliance weights: {str(e)}")


@app.post("/projects/{project_id}/compliance-weights/reset")
async def reset_compliance_weights(project_id: int, recalculate: bool = False):
    """
    Reset compliance weights to defaults for a project.
    Optionally recalculates all DPR scores in the project.
    """
    import backend.compliance_calculator as compliance_calc
    
    try:
        # Verify project exists
        project = db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        # Get default weights
        default_weights = compliance_calc.get_default_weights()
        
        # Update project with defaults
        success = compliance_calc.update_project_weights(project_id, default_weights)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to reset project weights")
        
        result = {
            "success": True,
            "message": "Weights reset to defaults",
            "weights": default_weights
        }
        
        # Recalculate DPR scores if requested
        if recalculate:
            print(f"⏳ Recalculating compliance scores for project {project_id} with defaults...")
            count_updated, failed_ids = compliance_calc.recalculate_project_dprs(
                project_id, 
                default_weights
            )
            
            result["recalculated"] = True
            result["dprs_updated"] = count_updated
            result["dprs_failed"] = len(failed_ids)
            
            if failed_ids:
                result["failed_dpr_ids"] = failed_ids
        else:
            result["recalculated"] = False
        
        return JSONResponse(result)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Reset compliance weights error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset compliance weights: {str(e)}")



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
            project_id=project_id
        )
        
        # Generate analysis in background
        print("⏳ Generating analysis...")
        try:
            parsed_json = await gemini_client.generate_json_from_file(file_ref, str(SCHEMA_PATH))
            print(f"✓ Generated analysis successfully")
            
            # Validate DPR against project if project_id is provided
            validation_flags = None
            if project_id is not None:
                validation_flags = db.validate_dpr_against_project(dpr_id, project_id, parsed_json)
                if validation_flags.get('hasFlags'):
                    print(f"⚠ DPR {dpr_id} has validation flags: {len(validation_flags['flags'])} issue(s)")
            
            db.update_dpr(dpr_id, parsed_json, validation_flags)
            
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
        try:
            # Single call to get both English and Hindi analysis (now async)
            parsed_json = await gemini_client.generate_json_from_file(file_ref, str(SCHEMA_PATH))
            
            print(f"✓ Generated analysis successfully")
            
            # Update database with analysis results
            db.update_dpr(dpr_id, parsed_json)
            
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
async def get_dpr(dpr_id: int):
    """
    Retrieve a stored DPR by ID.
    
    Returns the DPR metadata and parsed JSON.
    
    Args:
        dpr_id: The DPR ID
        
    """
    dpr = db.get_dpr(dpr_id)
    
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    
    return JSONResponse(dpr)




@app.get("/dpr/{dpr_id}/pdf")
async def get_dpr_pdf(dpr_id: int):
    """
    Serve the PDF file for a DPR.
    Can be used for both viewing (in new tab) and downloading.
    """
    dpr = db.get_dpr(dpr_id)
    
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    filepath = dpr.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="PDF file not found on server")
    
    # Read the PDF file
    with open(filepath, "rb") as f:
        content = f.read()
    
    # Return the PDF with appropriate headers
    # The browser will handle viewing based on the Content-Disposition header
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{dpr.get("original_filename", "document.pdf")}"'
        }
    )

@app.post("/dprs/{dpr_id}/analyze")
async def analyze_dpr(dpr_id: int):
    """
    Trigger analysis on an unanalyzed DPR (typically client-uploaded).
    Admin endpoint to run Gemini analysis on uploaded PDFs.
    """
    # Verify DPR exists
    dpr = db.get_dpr(dpr_id)
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    # Check if already analyzed
    if dpr.get("summary_json"):
        return JSONResponse({
            "message": "DPR already analyzed",
            "dpr_id": dpr_id,
            "existing": True
        })
    
    try:
        # Set status to 'analyzing' before starting
        import sqlite3
        conn = sqlite3.connect(str(DATA_DIR / "dpr.db"))
        cursor = conn.cursor()
        cursor.execute("UPDATE dprs SET status = 'analyzing' WHERE id = ?", (dpr_id,))
        conn.commit()
        conn.close()
        
        file_ref = dpr["uploaded_file_ref"]
        
        print(f"⏳ Analyzing DPR {dpr_id}...")
        
        # Generate analysis in multiple languages
        parsed_json = await gemini_client.generate_json_from_file(file_ref, str(SCHEMA_PATH))
        
        print(f"✓ Generated analysis successfully")
        
        # Validate DPR against project if project_id exists
        validation_flags = None
        if dpr.get('project_id'):
            validation_flags = db.validate_dpr_against_project(dpr_id, dpr['project_id'], parsed_json)
            if validation_flags.get('hasFlags'):
                print(f"⚠ DPR {dpr_id} has validation flags: {len(validation_flags['flags'])} issue(s)")
        
        # Update database with analysis results and validation flags
        db.update_dpr(dpr_id, parsed_json, validation_flags)
        
        # Set status to 'completed'
        conn = sqlite3.connect(str(DATA_DIR / "dpr.db"))
        cursor = conn.cursor()
        cursor.execute("UPDATE dprs SET status = 'completed' WHERE id = ?", (dpr_id,))
        conn.commit()
        conn.close()
        
        return JSONResponse({
            "message": "Analysis complete",
            "dpr_id": dpr_id,
            "summary": parsed_json
        })
        
    except Exception as e:
        # Reset status to 'pending' on error
        import sqlite3
        conn = sqlite3.connect(str(DATA_DIR / "dpr.db"))
        cursor = conn.cursor()
        cursor.execute("UPDATE dprs SET status = 'pending' WHERE id = ?", (dpr_id,))
        conn.commit()
        conn.close()
        
        print(f"✗ Analysis failed for DPR {dpr_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze DPR: {str(e)}")



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
        
        try:
            # Get response from Gemini (now async)
            response = await gemini_client.send_chat_message(
                dpr_id=dpr_id,
                message=chat_message.message,
                file_ref=dpr["uploaded_file_ref"]
            )
        except gemini_client.FileExpiredError:
            print(f"⚠ File for DPR {dpr_id} expired. Re-uploading...")
            
            # Re-upload the file
            if not os.path.exists(dpr["filepath"]):
                raise HTTPException(status_code=404, detail="Original file not found on server, cannot re-upload.")
            
            new_file_ref = await gemini_client.upload_file(dpr["filepath"])
            
            # Update database with new file reference
            db.update_dpr_file_ref(dpr_id, new_file_ref)
            
            # Clear old chat session to force recreation with new file
            gemini_client.clear_chat_session(dpr_id)
            
            # Retry sending message
            print(f"↺ Retrying chat message for DPR {dpr_id} with new file ref...")
            response = await gemini_client.send_chat_message(
                dpr_id=dpr_id,
                message=chat_message.message,
                file_ref=new_file_ref
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
        
        try:
            # Get response from Gemini (now async)
            response = await gemini_client.send_comparison_message(
                comparison_id=comparison_id, 
                message=chat_message.message, 
                file_refs=file_refs
            )
        except gemini_client.FileExpiredError:
            print(f"⚠ Files for comparison {comparison_id} expired. Re-uploading all...")
            
            # Re-upload all files in the comparison
            new_file_refs = []
            for dpr in comparison["dprs"]:
                print(f"↺ Re-uploading {dpr['filename']}...")
                if not os.path.exists(dpr["filepath"]):
                    raise HTTPException(status_code=404, detail=f"Original file {dpr['filename']} not found on server.")
                
                new_ref = await gemini_client.upload_file(dpr["filepath"])
                db.update_dpr_file_ref(dpr["id"], new_ref)
                new_file_refs.append(new_ref)
            
            # Clear old session
            gemini_client.clear_comparison_chat_session(comparison_id)
            
            # Retry with new file references
            print(f"↺ Retrying comparison chat message...")
            response = await gemini_client.send_comparison_message(
                comparison_id=comparison_id, 
                message=chat_message.message, 
                file_refs=new_file_refs
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



@app.post("/comparison-chat/{comparison_id}/add-dpr")
async def add_dpr_to_comparison_endpoint(comparison_id: int, request: dict):
    """Add a DPR to an existing comparison."""
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    
    dpr_id = request.get("dpr_id")
    if not dpr_id:
        raise HTTPException(status_code=400, detail="dpr_id is required")
    
    # Check if DPR exists
    dpr = db.get_dpr(dpr_id)
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    try:
        success = db.add_dpr_to_comparison(comparison_id, dpr_id)
        if not success:
            raise HTTPException(status_code=400, detail="DPR is already in this comparison")
        
        # Clear the chat session so next messages use updated PDF list
        gemini_client.clear_comparison_chat_session(comparison_id)
        print(f"✓ Cleared comparison chat session {comparison_id} after adding DPR")
        
        # Return updated comparison
        updated_comparison = db.get_comparison_chat(comparison_id)
        return JSONResponse(updated_comparison)
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Add DPR to comparison error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add DPR to comparison: {str(e)}")


@app.delete("/comparison-chat/{comparison_id}/remove-dpr/{dpr_id}")
async def remove_dpr_from_comparison_endpoint(comparison_id: int, dpr_id: int):
    """Remove a DPR from a comparison."""
    comparison = db.get_comparison_chat(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison chat {comparison_id} not found")
    
    try:
        success = db.remove_dpr_from_comparison(comparison_id, dpr_id)
        if not success:
            raise HTTPException(status_code=400, detail="Cannot remove DPR: comparison must have at least 2 DPRs")
        
        # Clear the chat session so next messages use updated PDF list
        gemini_client.clear_comparison_chat_session(comparison_id)
        print(f"✓ Cleared comparison chat session {comparison_id} after removing DPR")
        
        return JSONResponse({"success": True, "message": f"Removed DPR {dpr_id} from comparison {comparison_id}"})
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Remove DPR from comparison error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remove DPR from comparison: {str(e)}")


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
