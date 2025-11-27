import sqlite3
import json
from typing import List, Dict

def update_dpr_processing_status(dpr_id: int, processing_status: str, db_path: str = "data/dpr.db"):
    """Update the processing status of a DPR."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE dprs 
        SET processing_status = ?
        WHERE id = ?
    """, (processing_status, dpr_id))
    
    conn.commit()
    conn.close()


def update_dpr_partial_analysis(dpr_id: int, partial_data: dict, db_path: str = "data/dpr.db"):
    """Update DPR with partial analysis results (for offline mode)."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get current summary_json
    cursor.execute("SELECT summary_json FROM dprs WHERE id = ?", (dpr_id,))
    row = cursor.fetchone()
    
    if row and row[0]:
        try:
            current_data = json.loads(row[0])
        except:
            current_data = {}
    else:
        current_data = {}
    
    # Merge partial data
    current_data.update(partial_data)
    json_str = json.dumps(current_data, indent=2)
    
    cursor.execute("""
        UPDATE dprs 
        SET summary_json = ?
        WHERE id = ?
    """, (json_str, dpr_id))
    
    conn.commit()
    conn.close()


def get_pending_sync_dprs(db_path: str = "data/dpr.db") -> List[Dict]:
    """Retrieve all DPRs that need to be synced with Gemini."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, filename, original_filename, filepath, uploaded_file_ref, upload_ts, summary_json
        FROM dprs
        WHERE sync_status = 'pending' AND is_offline = 1
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
            "summary_json": json.loads(row["summary_json"]) if row["summary_json"] else None
        }
        for row in rows
    ]


def mark_dpr_synced(dpr_id: int, db_path: str = "data/dpr.db"):
    """Mark a DPR as synced after successful Gemini analysis."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE dprs 
        SET sync_status = 'synced', is_offline = 0, processing_status = NULL
        WHERE id = ?
    """, (dpr_id,))
    
    conn.commit()
    conn.close()
    print(f"✓ DPR {dpr_id} marked as synced")
