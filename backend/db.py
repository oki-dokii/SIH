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
            filepath TEXT NOT NULL,
            uploaded_file_ref TEXT NOT NULL,
            upload_ts TEXT NOT NULL,
            summary_json TEXT NOT NULL
        )
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


def insert_dpr(filename: str, filepath: str, file_ref: str, summary_json: dict, 
               db_path: str = "data/dpr.db") -> int:
    """Insert a new DPR record and return its ID."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    json_str = json.dumps(summary_json, indent=2)
    
    cursor.execute("""
        INSERT INTO dprs (filename, filepath, uploaded_file_ref, upload_ts, summary_json)
        VALUES (?, ?, ?, ?, ?)
    """, (filename, filepath, file_ref, timestamp, json_str))
    
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
        SELECT id, filename, filepath, uploaded_file_ref, upload_ts, summary_json
        FROM dprs WHERE id = ?
    """, (dpr_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row["id"],
            "filename": row["filename"],
            "filepath": row["filepath"],
            "uploaded_file_ref": row["uploaded_file_ref"],
            "upload_ts": row["upload_ts"],
            "summary_json": json.loads(row["summary_json"])
        }
    return None


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