import sqlite3
import json
import hashlib
from datetime import datetime
from typing import Optional, Dict, List
from pathlib import Path


def init_db(db_path: str = "data/cloud.db"):
    """
    Initialize cloud backend database with simplified schema.
    Only stores projects and files metadata - no chunks or messages.
    """
    # Ensure data directory exists
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Projects table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            state TEXT NOT NULL,
            scheme TEXT NOT NULL,
            sector TEXT NOT NULL,
            created_ts TEXT DEFAULT (datetime('now')),
            updated_ts TEXT DEFAULT (datetime('now'))
        )
    """)
    
    # Files table (simplified - no chunks or analysis)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            upload_ts TEXT DEFAULT (datetime('now')),
            updated_ts TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    """)
    
    # DPRs table - stores uploaded PDF metadata
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS dprs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            original_filename TEXT NOT NULL,
            file_size INTEGER,
            file_hash TEXT,
            filepath TEXT NOT NULL,
            upload_ts TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    """)
    
    # Create indexes for faster sync queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_projects_updated 
        ON projects(updated_ts)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_files_updated 
        ON files(updated_ts)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_files_project 
        ON files(project_id)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_dprs_project 
        ON dprs(project_id)
    """)
    
    conn.commit()
    conn.close()
    print(f"✅ Cloud database initialized: {db_path}")


# ===== PROJECT OPERATIONS =====

def create_project(name: str, state: str, scheme: str, sector: str, 
                   db_path: str = "data/cloud.db") -> int:
    """Create a new project and return its ID."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO projects (name, state, scheme, sector)
        VALUES (?, ?, ?, ?)
    """, (name, state, scheme, sector))
    
    project_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return project_id


def update_project(project_id: int, name: str, state: str, scheme: str, 
                   sector: str, db_path: str = "data/cloud.db") -> bool:
    """Update an existing project."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE projects 
        SET name = ?, state = ?, scheme = ?, sector = ?,
            updated_ts = datetime('now')
        WHERE id = ?
    """, (name, state, scheme, sector, project_id))
    
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    
    return success


def get_project(project_id: int, db_path: str = "data/cloud.db") -> Optional[Dict]:
    """Retrieve a project by ID."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM projects WHERE id = ?
    """, (project_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def get_all_projects(since: Optional[str] = None, 
                     db_path: str = "data/cloud.db") -> List[Dict]:
    """
    Retrieve all projects, optionally filtered by update timestamp.
    
    Args:
        since: ISO timestamp string - only return projects updated after this time
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if since:
        cursor.execute("""
            SELECT p.*, COUNT(d.id) as dpr_count
            FROM projects p
            LEFT JOIN dprs d ON p.id = d.project_id
            WHERE p.updated_ts > ?
            GROUP BY p.id
            ORDER BY p.updated_ts DESC
        """, (since,))
    else:
        cursor.execute("""
            SELECT p.*, COUNT(d.id) as dpr_count
            FROM projects p
            LEFT JOIN dprs d ON p.id = d.project_id
            GROUP BY p.id
            ORDER BY p.updated_ts DESC
        """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


# ===== DPR OPERATIONS =====

def create_dpr(project_id: int, original_filename: str, filepath: str,
               file_size: int, file_hash: str, db_path: str = "data/cloud.db") -> int:
    """Create a new DPR record and return its ID."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO dprs (project_id, original_filename, filepath, file_size, file_hash)
        VALUES (?, ?, ?, ?, ?)
    """, (project_id, original_filename, filepath, file_size, file_hash))
    
    dpr_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return dpr_id


def get_dpr(dpr_id: int, db_path: str = "data/cloud.db") -> Optional[Dict]:
    """Retrieve a DPR by ID."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM dprs WHERE id = ?
    """, (dpr_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def get_project_dprs(project_id: int, db_path: str = "data/cloud.db") -> List[Dict]:
    """Retrieve all DPRs for a specific project."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM dprs 
        WHERE project_id = ?
        ORDER BY upload_ts DESC
    """, (project_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def get_all_dprs(since: Optional[str] = None, 
                 db_path: str = "data/cloud.db") -> List[Dict]:
    """
    Retrieve all DPRs, optionally filtered by upload timestamp.
    
    Args:
        since: ISO timestamp string - only return DPRs uploaded after this time
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if since:
        cursor.execute("""
            SELECT * FROM dprs 
            WHERE upload_ts > ?
            ORDER BY upload_ts DESC
        """, (since,))
    else:
        cursor.execute("""
            SELECT * FROM dprs 
            ORDER BY upload_ts DESC
        """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def delete_dpr(dpr_id: int, db_path: str = "data/cloud.db") -> Optional[str]:
    """
    Delete a DPR record and return its filepath.
    Returns None if DPR not found.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get filepath before deleting
    cursor.execute("SELECT filepath FROM dprs WHERE id = ?", (dpr_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None
    
    filepath = row[0]
    
    cursor.execute("DELETE FROM dprs WHERE id = ?", (dpr_id,))
    conn.commit()
    conn.close()
    
    return filepath


# ===== LEGACY FILE OPERATIONS (keep for backward compatibility) =====

def create_file(project_id: int, filename: str, original_filename: str, 
                filepath: str, db_path: str = "data/cloud.db") -> int:
    """Create a new file record and return its ID."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO files (project_id, filename, original_filename, filepath)
        VALUES (?, ?, ?, ?)
    """, (project_id, filename, original_filename, filepath))
    
    file_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return file_id


def get_file(file_id: int, db_path: str = "data/cloud.db") -> Optional[Dict]:
    """Retrieve a file by ID."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM files WHERE id = ?
    """, (file_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def get_project_files(project_id: int, db_path: str = "data/cloud.db") -> List[Dict]:
    """Retrieve all files for a specific project."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM files 
        WHERE project_id = ?
        ORDER BY upload_ts DESC
    """, (project_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def get_all_files(since: Optional[str] = None, 
                  db_path: str = "data/cloud.db") -> List[Dict]:
    """
    Retrieve all files, optionally filtered by update timestamp.
    
    Args:
        since: ISO timestamp string - only return files updated after this time
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if since:
        cursor.execute("""
            SELECT * FROM files 
            WHERE updated_ts > ?
            ORDER BY updated_ts DESC
        """, (since,))
    else:
        cursor.execute("""
            SELECT * FROM files 
            ORDER BY updated_ts DESC
        """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def delete_file(file_id: int, db_path: str = "data/cloud.db") -> Optional[str]:
    """
    Delete a file record and return its filepath.
    Returns None if file not found.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get filepath before deleting
    cursor.execute("SELECT filepath FROM files WHERE id = ?", (file_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None
    
    filepath = row[0]
    
    cursor.execute("DELETE FROM files WHERE id = ?", (file_id,))
    conn.commit()
    conn.close()
    
    return filepath
