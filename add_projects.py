"""
Quick script to add missing projects endpoints to app.py
"""

# Read the file
with open("backend/app.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find where to insert (after CreateComparisonRequest class)
insert_index = None
for i, line in enumerate(lines):
    if "class CreateComparisonRequest" in line:
        # Find the end of this class (next blank line or next class/decorator)
        for j in range(i+1, len(lines)):
            if lines[j].strip() == "" or lines[j].startswith("class ") or lines[j].startswith("@") or lines[j].startswith("#"):
                insert_index = j
                break
        break

if insert_index is None:
    print("Could not find insertion point")
    exit(1)

# Projects code to insert
projects_code = '''
class CreateProjectRequest(BaseModel):
    name: str
    state: str
    scheme: str
    sector: str


# ===== API ROUTES =====

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

'''

# Insert the code
lines.insert(insert_index, projects_code)

# Write back
with open("backend/app.py", "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"✅ Added projects endpoints at line {insert_index}")
print("Projects API routes added successfully!")
