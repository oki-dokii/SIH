
import os

content_to_append = '''
# ===== PROJECT FUNCTIONS =====

def get_projects(db_path: str = "data/dpr.db") -> List[Dict]:
    """Retrieve all projects with their DPR counts."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT p.*, COUNT(d.id) as dpr_count
        FROM projects p
        LEFT JOIN dprs d ON p.id = d.project_id
        GROUP BY p.id
        ORDER BY p.created_ts DESC
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def create_project(name: str, state: str, scheme: str, sector: str, db_path: str = "data/dpr.db") -> int:
    """Create a new project."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO projects (name, state, scheme, sector, created_ts)
        VALUES (?, ?, ?, ?, ?)
    """, (name, state, scheme, sector, timestamp))
    
    project_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(f"✓ Project created with ID: {project_id}")
    return project_id


def delete_project(project_id: int, db_path: str = "data/dpr.db") -> bool:
    """Delete a project and unlink its DPRs."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Unlink DPRs (set project_id to NULL)
    cursor.execute("""
        UPDATE dprs SET project_id = NULL WHERE project_id = ?
    """, (project_id,))
    
    # Delete project
    cursor.execute("""
        DELETE FROM projects WHERE id = ?
    """, (project_id,))
    
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    
    return deleted


def get_project(project_id: int, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Get project details."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def get_dprs_by_project(project_id: int, db_path: str = "data/dpr.db") -> List[Dict]:
    """Get all DPRs for a specific project."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, filename, original_filename, upload_ts, summary_json, project_id
        FROM dprs
        WHERE project_id = ?
        ORDER BY upload_ts DESC
    """, (project_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    dprs = []
    for row in rows:
        dpr = dict(row)
        if dpr['summary_json']:
            try:
                dpr['summary_json'] = json.loads(dpr['summary_json'])
            except:
                dpr['summary_json'] = None
        dprs.append(dpr)
        
    return dprs
'''

with open("backend/db.py", "a", encoding="utf-8") as f:
    f.write(content_to_append)

print("✅ Appended project functions to db.py")
