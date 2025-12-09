import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import database as db

# Initialize FastAPI app
app = FastAPI(title="Cloud Backend - PDF Project Manager")

# CORS configuration - allow all origins for client access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact client domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
DB_PATH = "data/cloud.db"
UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Initialize database on startup
db.init_db(DB_PATH)


# ===== PYDANTIC MODELS =====

class ProjectCreate(BaseModel):
    name: str
    state: str
    scheme: str
    sector: str


class ProjectUpdate(BaseModel):
    name: str
    state: str
    scheme: str
    sector: str


# ===== HEALTH CHECK =====

@app.get("/ping")
def ping():
    """Health check endpoint for connectivity testing."""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ===== PROJECT ENDPOINTS =====

@app.get("/projects")
def list_projects(since: Optional[str] = None):
    """
    List all projects.
    
    Args:
        since: Optional ISO timestamp - only return projects updated after this time
    """
    projects = db.get_all_projects(since=since, db_path=DB_PATH)
    return {"projects": projects}


@app.post("/projects")
def create_project(project: ProjectCreate):
    """
    Create a new project.
    Called by admin during sync-up.
    """
    project_id = db.create_project(
        name=project.name,
        state=project.state,
        scheme=project.scheme,
        sector=project.sector,
        db_path=DB_PATH
    )
    
    # Return the created project
    created_project = db.get_project(project_id, db_path=DB_PATH)
    return created_project


@app.put("/projects/{project_id}")
def update_project(project_id: int, project: ProjectUpdate):
    """
    Update an existing project.
    Called by admin during sync-up.
    """
    success = db.update_project(
        project_id=project_id,
        name=project.name,
        state=project.state,
        scheme=project.scheme,
        sector=project.sector,
        db_path=DB_PATH
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Return updated project
    updated_project = db.get_project(project_id, db_path=DB_PATH)
    return updated_project


@app.get("/projects/{project_id}")
def get_project(project_id: int):
    """Get project details including all files."""
    project = db.get_project(project_id, db_path=DB_PATH)
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get files for this project
    files = db.get_project_files(project_id, db_path=DB_PATH)
    project["files"] = files
    
    return project


# ===== FILE ENDPOINTS =====

@app.post("/projects/{project_id}/upload_pdf")
async def upload_pdf(
    project_id: int,
    file: UploadFile = File(...)
):
    """
    Upload a PDF file to a project.
    Called by clients to upload PDFs.
    
    Flow:
    1. Validate project exists
    2. Save file to disk
    3. Create file record in database
    4. Return file metadata
    """
    # Verify project exists
    project = db.get_project(project_id, db_path=DB_PATH)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    safe_filename = f"{timestamp}_{unique_id}_{file.filename}"
    filepath = UPLOAD_DIR / safe_filename
    
    # Save file to disk
    try:
        with open(filepath, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Create file record in database
    file_id = db.create_file(
        project_id=project_id,
        filename=safe_filename,
        original_filename=file.filename,
        filepath=str(filepath),
        db_path=DB_PATH
    )
    
    return {
        "id": file_id,
        "filename": safe_filename,
        "original_filename": file.filename,
        "message": "File uploaded successfully"
    }


@app.get("/files")
def list_files(since: Optional[str] = None):
    """
    List all files.
    
    Args:
        since: Optional ISO timestamp - only return files updated after this time
    """
    files = db.get_all_files(since=since, db_path=DB_PATH)
    return {"files": files}


@app.get("/files/{file_id}")
def get_file(file_id: int):
    """Get file metadata."""
    file_data = db.get_file(file_id, db_path=DB_PATH)
    
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")
    
    return file_data


@app.delete("/files/{file_id}")
def delete_file(file_id: int):
    """Delete a file and its record."""
    filepath = db.delete_file(file_id, db_path=DB_PATH)
    
    if not filepath:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete file from disk
    try:
        Path(filepath).unlink(missing_ok=True)
    except Exception as e:
        print(f"Warning: Failed to delete file from disk: {e}")
    
    return {"message": "File deleted successfully"}


# ===== DPR ENDPOINTS =====

@app.post("/projects/{project_id}/upload_pdf")
async def upload_pdf_to_cloud(project_id: int, file: UploadFile = File(...)):
    """
    Upload a PDF file to a project (from online version).
    Stores file and creates DPR record.
    """
    import hashlib
    
    # Verify project exists
    project = db.get_project(project_id, db_path=DB_PATH)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    
    # Create upload directory
    upload_dir = UPLOAD_DIR / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    filepath = upload_dir / file.filename
    try:
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        
        # Calculate hash
        file_hash = hashlib.md5(content).hexdigest()
        file_size = len(content)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Create DPR record
    dpr_id = db.create_dpr(
        project_id=project_id,
        original_filename=file.filename,
        filepath=str(filepath),
        file_size=file_size,
        file_hash=file_hash,
        db_path=DB_PATH
    )
    
    return {
        "id": dpr_id,
        "filename": file.filename,
        "message": "PDF uploaded successfully"
    }


@app.get("/dprs/all")
def list_all_dprs(since: Optional[str] = None):
    """
    List all DPRs across all projects.
    Used by offline version for syncing.
    """
    dprs = db.get_all_dprs(since=since, db_path=DB_PATH)
    return {"dprs": dprs}


@app.get("/projects/{project_id}/dprs")
def list_project_dprs(project_id: int):
    """
    List all DPRs for a specific project.
    """
    dprs = db.get_project_dprs(project_id, db_path=DB_PATH)
    return {"dprs": dprs}


@app.get("/dprs/{dpr_id}/download")
async def download_pdf(dpr_id: int):
    """
    Download a PDF file.
    Used by offline version to download PDFs.
    """
    from fastapi.responses import FileResponse
    import os
    
    dpr = db.get_dpr(dpr_id, db_path=DB_PATH)
    if not dpr:
        raise HTTPException(status_code=404, detail="DPR not found")
    
    filepath = dpr['filepath']
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="PDF file not found on disk")
    
    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=dpr['original_filename']
    )


# ===== ADMIN SYNC ENDPOINTS =====

@app.post("/sync/projects/batch")
def sync_projects_batch(projects: list[dict]):
    """
    Batch sync projects from admin.
    Creates new projects or updates existing ones based on remote_id.
    
    Request body: List of project objects with optional 'id' field
    Returns: Mapping of local IDs to cloud IDs
    """
    id_mapping = {}
    
    for project_data in projects:
        cloud_id = project_data.get("id")  # Cloud ID if updating
        
        if cloud_id:
            # Update existing project
            success = db.update_project(
                project_id=cloud_id,
                name=project_data["name"],
                state=project_data["state"],
                scheme=project_data["scheme"],
                sector=project_data["sector"],
                db_path=DB_PATH
            )
            if success:
                id_mapping[project_data.get("local_id", cloud_id)] = cloud_id
        else:
            # Create new project
            new_id = db.create_project(
                name=project_data["name"],
                state=project_data["state"],
                scheme=project_data["scheme"],
                sector=project_data["sector"],
                db_path=DB_PATH
            )
            id_mapping[project_data.get("local_id", new_id)] = new_id
    
    return {"id_mapping": id_mapping}


# ===== STARTUP =====

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
