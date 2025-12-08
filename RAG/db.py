import sqlite3
import json
from datetime import datetime
from typing import Optional, Dict, List


def init_db(db_path: str = "data/chat.db"):
    """
    Initialize SQLite database with required tables.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create projects table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_ts TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create pdfs table with project_id and chunks_stored flag
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pdfs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            num_chunks INTEGER,
            chunks_stored INTEGER DEFAULT 0,
            upload_ts TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    """)
    
    # Create chunks table for persistent storage
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pdf_id INTEGER NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
        )
    """)
    
    # Create messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pdf_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
        )
    """)
    
    # Add state column to projects table if it doesn't exist (migration from old schema)
    try:
        cursor.execute("""
            ALTER TABLE projects 
            ADD COLUMN state TEXT
        """)
        print("✓ Added state column to projects table")
    except sqlite3.OperationalError:
        pass
    
    # Remove description column if you want to fully migrate (optional - can keep for backward compatibility)
    # SQLite doesn't support DROP COLUMN easily, so we'll just add new columns
    
    # Add sectional_analysis column if it doesn't exist (migration)
    try:
        cursor.execute("""
            ALTER TABLE pdfs 
            ADD COLUMN sectional_analysis TEXT
        """)
        print("✓ Added sectional_analysis column to pdfs table")
    except sqlite3.OperationalError:
        # Column already exists
        pass
    
    # Add processing_status column for async processing tracking
    try:
        cursor.execute("""
            ALTER TABLE pdfs 
            ADD COLUMN processing_status TEXT DEFAULT 'pending'
        """)
        print("✓ Added processing_status column to pdfs table")
    except sqlite3.OperationalError:
        pass
    
    # Add error_message column for failed processing
    try:
        cursor.execute("""
            ALTER TABLE pdfs 
            ADD COLUMN error_message TEXT
        """)
        print("✓ Added error_message column to pdfs table")
    except sqlite3.OperationalError:
        pass
    
    conn.commit()
    conn.close()
    print(f"✓ Database initialized: {db_path}")


# ===== PROJECT CRUD OPERATIONS =====

def create_project(name: str, state: str, scheme: str, sector: str, db_path: str = "data/chat.db") -> int:
    """
    Create a new project and return its ID.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO projects (name, state, scheme, sector, created_ts)
        VALUES (?, ?, ?, ?, ?)
    """, (name, state, scheme, sector, datetime.now().isoformat()))
    
    project_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return project_id


def get_project(project_id: int, db_path: str = "data/chat.db") -> Optional[Dict]:
    """
    Retrieve a project by ID.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, name, description, created_ts
        FROM projects
        WHERE id = ?
    """, (project_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def get_all_projects(db_path: str = "data/chat.db") -> List[Dict]:
    """
    Retrieve all projects with PDF counts.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT p.id, p.name, p.description, p.created_ts,
               COUNT(d.id) as pdf_count
        FROM projects p
        LEFT JOIN pdfs d ON p.id = d.project_id
        GROUP BY p.id
        ORDER BY p.created_ts DESC
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def delete_project(project_id: int, db_path: str = "data/chat.db") -> bool:
    """
    Delete a project and all associated PDFs.
    Returns True if successful.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Delete project (CASCADE will handle PDFs, chunks, and messages)
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    
    return deleted


def get_project_pdfs(project_id: int, db_path: str = "data/chat.db") -> List[Dict]:
    """
    Retrieve all PDFs for a specific project.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT p.id, p.filename, p.original_filename, p.filepath, 
               p.num_chunks, p.chunks_stored, p.sectional_analysis, p.processing_status, p.upload_ts,
               COUNT(m.id) as message_count
        FROM pdfs p
        LEFT JOIN messages m ON p.id = m.pdf_id
        WHERE p.project_id = ?
        GROUP BY p.id
        ORDER BY p.upload_ts DESC
    """, (project_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


# ===== PDF CRUD OPERATIONS =====

def insert_pdf(filename: str, original_filename: str, filepath: str, 
               project_id: int, num_chunks: int = None, db_path: str = "data/chat.db") -> int:
    """
    Insert a new PDF record and return its ID.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO pdfs (project_id, filename, original_filename, filepath, num_chunks, chunks_stored, upload_ts)
        VALUES (?, ?, ?, ?, ?, 0, ?)
    """, (project_id, filename, original_filename, filepath, num_chunks, datetime.now().isoformat()))
    
    pdf_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return pdf_id


def get_pdf(pdf_id: int, db_path: str = "data/chat.db") -> Optional[Dict]:
    """
    Retrieve a PDF by ID.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, project_id, filename, original_filename, filepath, num_chunks, chunks_stored, upload_ts
        FROM pdfs
        WHERE id = ?
    """, (pdf_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def get_pdf_by_filename(original_filename: str, db_path: str = "data/chat.db") -> Optional[Dict]:
    """
    Retrieve a PDF by original filename.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, project_id, filename, original_filename, filepath, num_chunks, chunks_stored, upload_ts
        FROM pdfs
        WHERE original_filename = ?
        ORDER BY upload_ts DESC
        LIMIT 1
    """, (original_filename,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def get_all_pdfs(project_id: Optional[int] = None, db_path: str = "data/chat.db") -> List[Dict]:
    """
    Retrieve all PDFs with metadata. Optionally filter by project_id.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if project_id is not None:
        cursor.execute("""
            SELECT p.id, p.project_id, p.filename, p.original_filename, p.filepath, 
                   p.num_chunks, p.chunks_stored, p.sectional_analysis, p.upload_ts,
                   COUNT(m.id) as message_count
            FROM pdfs p
            LEFT JOIN messages m ON p.id = m.pdf_id
            WHERE p.project_id = ?
            GROUP BY p.id
            ORDER BY p.upload_ts DESC
        """, (project_id,))
    else:
        cursor.execute("""
            SELECT p.id, p.project_id, p.filename, p.original_filename, p.filepath, 
                   p.num_chunks, p.chunks_stored, p.sectional_analysis, p.upload_ts,
                   COUNT(m.id) as message_count
            FROM pdfs p
            LEFT JOIN messages m ON p.id = m.pdf_id
            GROUP BY p.id
            ORDER BY p.upload_ts DESC
        """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def update_pdf_chunks_stored(pdf_id: int, num_chunks: int, db_path: str = "data/chat.db") -> bool:
    """
    Mark PDF as having chunks stored in database.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE pdfs 
        SET chunks_stored = 1, num_chunks = ?
        WHERE id = ?
    """, (num_chunks, pdf_id))
    
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    
    return updated


def delete_pdf(pdf_id: int, db_path: str = "data/chat.db") -> Optional[str]:
    """
    Delete a PDF and all associated chunks and messages.
    Returns the filepath of the deleted PDF so it can be removed from disk.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get filepath before deletion
    cursor.execute("SELECT filepath FROM pdfs WHERE id = ?", (pdf_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None
    
    filepath = row[0]
    
    # Delete chunks (CASCADE will handle this, but explicit is clearer)
    cursor.execute("DELETE FROM chunks WHERE pdf_id = ?", (pdf_id,))
    
    # Delete messages
    cursor.execute("DELETE FROM messages WHERE pdf_id = ?", (pdf_id,))
    
    # Delete PDF record
    cursor.execute("DELETE FROM pdfs WHERE id = ?", (pdf_id,))
    
    conn.commit()
    conn.close()
    
    return filepath


def update_pdf_analysis(pdf_id: int, analysis_json: str, db_path: str = "data/chat.db") -> bool:
    """
    Store sectional analysis JSON for a PDF.
    
    Args:
        pdf_id: ID of the PDF
        analysis_json: JSON string of analysis results
        db_path: Path to database
        
    Returns:
        True if successful
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE pdfs 
        SET sectional_analysis = ?
        WHERE id = ?
    """, (analysis_json, pdf_id))
    
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    
    return updated


def get_pdf_analysis(pdf_id: int, db_path: str = "data/chat.db") -> Optional[dict]:
    """
    Retrieve sectional analysis for a PDF.
    
    Args:
        pdf_id: ID of the PDF
        db_path: Path to database
        
    Returns:
        Analysis JSON as dict, or None if not found
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT sectional_analysis
        FROM pdfs
        WHERE id = ?
    """, (pdf_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row and row[0]:
        try:
            return json.loads(row[0])
        except json.JSONDecodeError:
            return None
    return None


# ===== CHUNK CRUD OPERATIONS =====

def insert_chunk(pdf_id: int, chunk_index: int, content: str, 
                 metadata: Dict = None, db_path: str = "data/chat.db") -> int:
    """
    Insert a chunk for a PDF.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    metadata_json = json.dumps(metadata) if metadata else None
    
    cursor.execute("""
        INSERT INTO chunks (pdf_id, chunk_index, content, metadata)
        VALUES (?, ?, ?, ?)
    """, (pdf_id, chunk_index, content, metadata_json))
    
    chunk_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return chunk_id


def get_pdf_chunks(pdf_id: int, db_path: str = "data/chat.db") -> List[Dict]:
    """
    Retrieve all chunks for a PDF.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, pdf_id, chunk_index, content, metadata
        FROM chunks
        WHERE pdf_id = ?
        ORDER BY chunk_index ASC
    """, (pdf_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    chunks = []
    for row in rows:
        chunk = dict(row)
        if chunk['metadata']:
            chunk['metadata'] = json.loads(chunk['metadata'])
        chunks.append(chunk)
    
    return chunks


def delete_pdf_chunks(pdf_id: int, db_path: str = "data/chat.db") -> int:
    """
    Delete all chunks for a PDF.
    Returns the number of deleted chunks.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM chunks WHERE pdf_id = ?", (pdf_id,))
    deleted_count = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    return deleted_count


# ===== MESSAGE CRUD OPERATIONS =====

def insert_message(pdf_id: int, role: str, text: str, db_path: str = "data/chat.db") -> int:
    """
    Insert a chat message (role: 'user' or 'assistant').
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO messages (pdf_id, role, text, timestamp)
        VALUES (?, ?, ?, ?)
    """, (pdf_id, role, text, datetime.now().isoformat()))
    
    message_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return message_id


def get_messages(pdf_id: int, db_path: str = "data/chat.db") -> List[Dict]:
    """
    Retrieve all chat messages for a PDF.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, pdf_id, role, text, timestamp
        FROM messages
        WHERE pdf_id = ?
        ORDER BY timestamp ASC
    """, (pdf_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def clear_chat_history(pdf_id: int, db_path: str = "data/chat.db") -> int:
    """
    Delete all chat messages for a specific PDF.
    Returns the number of deleted messages.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM messages WHERE pdf_id = ?", (pdf_id,))
    deleted_count = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    return deleted_count


# ===== STATUS MANAGEMENT =====

def update_pdf_status(pdf_id: int, status: str, error_message: str = None, db_path: str = "data/chat.db") -> bool:
    """Update PDF processing status"""
    import sqlite3
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE pdfs SET processing_status = ?, error_message = ? WHERE id = ?", 
                   (status, error_message, pdf_id))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def get_pdf_status(pdf_id: int, db_path: str = "data/chat.db"):
    """Get PDF processing status"""
    import sqlite3
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT processing_status, error_message FROM pdfs WHERE id = ?", (pdf_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None
