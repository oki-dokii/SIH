import sqlite3
import json
from datetime import datetime

DB_PATH = "data/dpr.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_pending_sync_dprs():
    """Get DPRs that are offline and need syncing."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Select DPRs where uploaded_file_ref is 'offline'
        cursor.execute("SELECT * FROM dprs WHERE uploaded_file_ref = 'offline'")
        dprs = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return dprs
    except Exception as e:
        print(f"Error getting pending sync DPRs: {e}")
        return []

def mark_dpr_synced(dpr_id):
    """Mark a DPR as synced."""
    # This is largely handled by updating the file_ref in the main db module,
    # but we can add additional logic here if needed.
    pass
