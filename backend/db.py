import sqlite3
import json
from datetime import datetime
from typing import Optional, Dict, List


def init_db(db_path: str = "data/dpr.db"):
    """Initialize SQLite database with required tables."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create DPRs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS dprs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            uploaded_file_ref TEXT NOT NULL,
            upload_ts TEXT NOT NULL,
            summary_json TEXT NOT NULL
        )
    """)
    
    # Create index on original_filename for faster lookups
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_original_filename 
        ON dprs(original_filename)
    """)
    
    # Create messages table for chat history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dpr_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (dpr_id) REFERENCES dprs (id)
        )
    """)
    
    conn.commit()
    conn.close()
    print(f"✓ Database initialized at {db_path}")


def insert_dpr(filename: str, original_filename: str, filepath: str, file_ref: str, 
               summary_json: dict, db_path: str = "data/dpr.db") -> int:
    """Insert a new DPR record and return its ID."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    json_str = json.dumps(summary_json, indent=2)
    
    cursor.execute("""
        INSERT INTO dprs (filename, original_filename, filepath, uploaded_file_ref, upload_ts, summary_json)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (filename, original_filename, filepath, file_ref, timestamp, json_str))
    
    dpr_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(f"✓ DPR inserted with ID: {dpr_id}")
    return dpr_id


def get_dpr(dpr_id: int, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a DPR by ID."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, filename, original_filename, filepath, uploaded_file_ref, upload_ts, summary_json
        FROM dprs WHERE id = ?
    """, (dpr_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row["id"],
            "filename": row["filename"],
            "original_filename": row["original_filename"],
            "filepath": row["filepath"],
            "uploaded_file_ref": row["uploaded_file_ref"],
            "upload_ts": row["upload_ts"],
            "summary_json": json.loads(row["summary_json"])
        }
    return None


def get_dpr_by_filename(original_filename: str, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a DPR by original filename."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, filename, original_filename, filepath, uploaded_file_ref, upload_ts, summary_json
        FROM dprs WHERE original_filename = ?
    """, (original_filename,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row["id"],
            "filename": row["filename"],
            "original_filename": row["original_filename"],
            "filepath": row["filepath"],
            "uploaded_file_ref": row["uploaded_file_ref"],
            "upload_ts": row["upload_ts"],
            "summary_json": json.loads(row["summary_json"])
        }
    return None


def get_all_dprs(db_path: str = "data/dpr.db") -> List[Dict]:
    """Retrieve all DPRs with metadata."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, filename, original_filename, filepath, uploaded_file_ref, upload_ts, summary_json
        FROM dprs
        ORDER BY upload_ts DESC
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": row["id"],
            "filename": row["filename"],
            "original_filename": row["original_filename"],
            "filepath": row["filepath"],
            "uploaded_file_ref": row["uploaded_file_ref"],
            "upload_ts": row["upload_ts"],
            "summary_json": json.loads(row["summary_json"])
        }
        for row in rows
    ]


def insert_message(dpr_id: int, role: str, text: str, db_path: str = "data/dpr.db"):
    """Insert a chat message (role: 'user' or 'assistant')."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO messages (dpr_id, role, text, timestamp)
        VALUES (?, ?, ?, ?)
    """, (dpr_id, role, text, timestamp))
    
    conn.commit()
    conn.close()


def get_messages(dpr_id: int, db_path: str = "data/dpr.db") -> List[Dict]:
    """Retrieve all chat messages for a DPR."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, dpr_id, role, text, timestamp
        FROM messages
        WHERE dpr_id = ?
        ORDER BY timestamp ASC
    """, (dpr_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": row["id"],
            "dpr_id": row["dpr_id"],
            "role": row["role"],
            "text": row["text"],
            "timestamp": row["timestamp"]
        }
        for row in rows
    ]


def clear_chat_history(dpr_id: int, db_path: str = "data/dpr.db"):
    """Delete all chat messages for a specific DPR."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        DELETE FROM messages WHERE dpr_id = ?
    """, (dpr_id,))
    
    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()
    
    print(f"✓ Cleared {deleted_count} messages for DPR {dpr_id}")
    return deleted_count