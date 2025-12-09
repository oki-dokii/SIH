import sqlite3
import json
from datetime import datetime
from typing import Optional, Dict, List


def init_db(db_path: str = "data/dpr.db"):
    """Initialize SQLite database with required tables."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create Projects table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            state TEXT NOT NULL,
            scheme TEXT NOT NULL,
            sector TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    # Create DPRs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS dprs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            uploaded_file_ref TEXT NOT NULL,
            upload_ts TEXT NOT NULL,
            summary_json TEXT,
            FOREIGN KEY (project_id) REFERENCES projects (id)
        )
    """)
    
    # MIGRATION: Check if summary_json column has NOT NULL constraint and needs to be relaxed
    # This requires recreating the table in SQLite
    cursor.execute("PRAGMA table_info(dprs)")
    columns_info = cursor.fetchall()
    columns = [col[1] for col in columns_info]
    
    # Find summary_json column info
    summary_json_info = next((col for col in columns_info if col[1] == 'summary_json'), None)
    if summary_json_info and summary_json_info[3] == 1:  # notnull = 1 means NOT NULL constraint
        print("⏳ Migrating database: relaxing summary_json NOT NULL constraint...")
        try:
            cursor.execute("PRAGMA foreign_keys=off;")
            cursor.execute("BEGIN TRANSACTION;")
            cursor.execute("""
                CREATE TABLE dprs_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER,
                    filename TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    filepath TEXT NOT NULL,
                    uploaded_file_ref TEXT NOT NULL,
                    upload_ts TEXT NOT NULL,
                    summary_json TEXT,
                    client_id INTEGER,
                    status TEXT DEFAULT 'completed',
                    FOREIGN KEY (project_id) REFERENCES projects (id)
                )
            """)
            cursor.execute("""
                INSERT INTO dprs_new (id, project_id, filename, original_filename, filepath, uploaded_file_ref, upload_ts, summary_json, client_id, status)
                SELECT id, project_id, filename, original_filename, filepath, uploaded_file_ref, upload_ts, summary_json, client_id, status FROM dprs
            """)
            cursor.execute("DROP TABLE dprs")
            cursor.execute("ALTER TABLE dprs_new RENAME TO dprs")
            cursor.execute("COMMIT;")
            cursor.execute("PRAGMA foreign_keys=on;")
            print("✓ Database migration complete (summary_json constraint relaxed)")
        except Exception as e:
            cursor.execute("ROLLBACK;")
            print(f"⚠ Migration failed: {e}")
    
    # Refresh columns list after potential migration
    cursor.execute("PRAGMA table_info(dprs)")
    columns = [col[1] for col in cursor.fetchall()]

    if 'project_id' not in columns:
        print("⏳ Migrating database: adding project_id column...")
        cursor.execute("ALTER TABLE dprs ADD COLUMN project_id INTEGER")
        cursor.execute("PRAGMA foreign_keys=off;")
        cursor.execute("BEGIN TRANSACTION;")
        # We can't easily add FK constraint to existing table in SQLite without recreating
        # For now just add the column
        cursor.execute("COMMIT;")
        cursor.execute("PRAGMA foreign_keys=on;")
        print("✓ Database migration complete (project_id)")
    
    if 'client_id' not in columns:
        print("⏳ Migrating database: adding client_id column...")
        cursor.execute("ALTER TABLE dprs ADD COLUMN client_id INTEGER")
        print("✓ Database migration complete (client_id)")
    
    if 'status' not in columns:
        print("⏳ Migrating database: adding status column...")
        cursor.execute("ALTER TABLE dprs ADD COLUMN status TEXT DEFAULT 'completed'")
        # Update existing NULL summary_json rows to 'pending'
        cursor.execute("UPDATE dprs SET status = 'pending' WHERE summary_json IS NULL")
        print("✓ Database migration complete (status)")
    
    if 'admin_feedback' not in columns:
        print("⏳ Migrating database: adding admin_feedback column...")
        cursor.execute("ALTER TABLE dprs ADD COLUMN admin_feedback TEXT")
        print("✓ Database migration complete (admin_feedback)")
    
    if 'feedback_timestamp' not in columns:
        print("⏳ Migrating database: adding feedback_timestamp column...")
        cursor.execute("ALTER TABLE dprs ADD COLUMN feedback_timestamp TEXT")
        print("✓ Database migration complete (feedback_timestamp)")
    
    if 'validation_flags' not in columns:
        print("⏳ Migrating database: adding validation_flags column...")
        cursor.execute("ALTER TABLE dprs ADD COLUMN validation_flags TEXT")
        print("✓ Database migration complete (validation_flags)")
    
    
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
    
    # Create comparison_chats table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS comparison_chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_ts TEXT NOT NULL
        )
    """)
    
    # Create comparison_chat_pdfs table (junction table)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS comparison_chat_pdfs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comparison_chat_id INTEGER NOT NULL,
            dpr_id INTEGER NOT NULL,
            FOREIGN KEY (comparison_chat_id) REFERENCES comparison_chats (id),
            FOREIGN KEY (dpr_id) REFERENCES dprs (id),
            UNIQUE (comparison_chat_id, dpr_id)
        )
    """)
    
    # Create unique index for comparison_chat_pdfs (idempotent for existing DBs)
    try:
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_comparison_chat_pdfs_unique 
            ON comparison_chat_pdfs(comparison_chat_id, dpr_id)
        """)
    except sqlite3.IntegrityError:
        print("⚠ Warning: Duplicate comparison_chat_pdfs entries detected. Cleaning up...")
        cursor.execute("""
            DELETE FROM comparison_chat_pdfs
            WHERE rowid NOT IN (
                SELECT MIN(rowid)
                FROM comparison_chat_pdfs
                GROUP BY comparison_chat_id, dpr_id
            )
        """)
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_comparison_chat_pdfs_unique 
            ON comparison_chat_pdfs(comparison_chat_id, dpr_id)
        """)
        print("✓ Duplicates removed and unique index created")
    
    # Create comparison_messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS comparison_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comparison_chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (comparison_chat_id) REFERENCES comparison_chats (id)
        )
    """)
    
    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            created_at TEXT NOT NULL
        )
    """)
    
    # Create unique index for username
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username 
        ON users(username)
    """)
    
    # MIGRATION: Add UNIQUE constraint on email if not exists
    cursor.execute("PRAGMA table_info(users)")
    users_columns = cursor.fetchall()
    
    # Check if email has unique constraint by checking indexes
    cursor.execute("PRAGMA index_list(users)")
    indexes = cursor.fetchall()
    has_email_unique = any('email' in str(idx) for idx in indexes)
    
    if not has_email_unique:
        print("⏳ Migrating database: adding UNIQUE constraint on email...")
        try:
            cursor.execute("PRAGMA foreign_keys=off;")
            cursor.execute("BEGIN TRANSACTION;")
            
            # Create new users table with email UNIQUE constraint
            cursor.execute("""
                CREATE TABLE users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    name TEXT,
                    username TEXT,
                    created_at TEXT NOT NULL
                )
            """)
            
            
            # Copy data from old table, keeping only most recent user per email
            # (in case of duplicates, keep the one with highest ID)
            cursor.execute("""
                INSERT INTO users_new (id, email, password_hash, name, username, created_at)
                SELECT id, email, password_hash, name, username, created_at 
                FROM users
                WHERE id IN (
                    SELECT MAX(id) FROM users GROUP BY email
                )
            """)
            
            # Drop old table and rename new one
            cursor.execute("DROP TABLE users")
            cursor.execute("ALTER TABLE users_new RENAME TO users")
            
            # Recreate email unique index
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
                ON users(email)
            """)
            
            cursor.execute("COMMIT;")
            cursor.execute("PRAGMA foreign_keys=on;")
            print("✓ Database migration complete (email UNIQUE constraint added)")
        except Exception as e:
            cursor.execute("ROLLBACK;")
            print(f"⚠ Email uniqueness migration failed: {e}")
            # Continue anyway - the table still exists

    
    # Migration: Add comparison_result and comparison_generated_at to projects table
    cursor.execute("PRAGMA table_info(projects)")
    projects_columns = [col[1] for col in cursor.fetchall()]
    
    if 'comparison_result' not in projects_columns:
        print("⏳ Migrating database: adding comparison columns to projects table...")
        try:
            cursor.execute("ALTER TABLE projects ADD COLUMN comparison_result TEXT")
            cursor.execute("ALTER TABLE projects ADD COLUMN comparison_generated_at TEXT")
            conn.commit()
            print("✓ Database migration complete (comparison columns added to projects)")
        except Exception as e:
            print(f"⚠ Projects comparison migration failed: {e}")
    
    # Migration: Add compliance_weights column to projects table
    if 'compliance_weights' not in projects_columns:
        print("⏳ Migrating database: adding compliance_weights column to projects table...")
        try:
            # Default compliance weights matching AI prompt
            default_weights = json.dumps({
                "northEasternFocus": 0.25,
                "beneficiaryAlignment": 0.20,
                "environmentalCompliance": 0.20,
                "landAcquisition": 0.15,
                "documentationQuality": 0.10,
                "financialViability": 0.10
            })
            
            cursor.execute("ALTER TABLE projects ADD COLUMN compliance_weights TEXT")
            # Set default weights for existing projects
            cursor.execute(f"UPDATE projects SET compliance_weights = ? WHERE compliance_weights IS NULL", (default_weights,))
            conn.commit()
            print("✓ Database migration complete (compliance_weights column added to projects)")
        except Exception as e:
            print(f"⚠ Compliance weights migration failed: {e}")
    
    # Create client_dprs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS client_dprs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            project_name TEXT NOT NULL,
            dpr_filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Review',
            created_at TEXT NOT NULL,
            FOREIGN KEY (client_id) REFERENCES users (id)
        )
    """)
    
    # Create index on client_id for faster lookups
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_client_dprs_client_id 
        ON client_dprs(client_id)
    """)
    
    conn.commit()
    conn.close()
    print(f"✓ Database initialized at {db_path}")


def insert_dpr(filename: str, original_filename: str, filepath: str, file_ref: str, 
               summary_json: dict, project_id: int = None, db_path: str = "data/dpr.db") -> int:
    """Insert a new DPR record and return its ID."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    json_str = json.dumps(summary_json, indent=2) if summary_json else None
    
    cursor.execute("""
        INSERT INTO dprs (filename, original_filename, filepath, uploaded_file_ref, upload_ts, summary_json, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (filename, original_filename, filepath, file_ref, timestamp, json_str, project_id))
    
    dpr_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(f"✓ DPR inserted with ID: {dpr_id}")
    return dpr_id


def update_dpr(dpr_id: int, summary_json: dict, validation_flags: dict = None, db_path: str = "data/dpr.db"):
    """Update an existing DPR record with analysis results and validation flags."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    json_str = json.dumps(summary_json, indent=2)
    
    if validation_flags is not None:
        validation_flags_str = json.dumps(validation_flags)
        cursor.execute("""
            UPDATE dprs 
            SET summary_json = ?, validation_flags = ?
            WHERE id = ?
        """, (json_str, validation_flags_str, dpr_id))
    else:
        cursor.execute("""
            UPDATE dprs 
            SET summary_json = ?
            WHERE id = ?
        """, (json_str, dpr_id))
    
    conn.commit()
    conn.close()
    print(f"✓ DPR {dpr_id} updated with analysis results")


def update_dpr_file_ref(dpr_id: int, file_ref: str, db_path: str = "data/dpr.db"):
    """Update the uploaded_file_ref for a DPR when re-uploading an expired file."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE dprs 
        SET uploaded_file_ref = ?
        WHERE id = ?
    """, (file_ref, dpr_id))
    
    conn.commit()
    conn.close()
    print(f"✓ DPR {dpr_id} file reference updated: {file_ref}")


def update_dpr_feedback(dpr_id: int, feedback: str, db_path: str = "data/dpr.db"):
    """Update admin feedback for a DPR."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    
    cursor.execute("""
        UPDATE dprs 
        SET admin_feedback = ?, feedback_timestamp = ?
        WHERE id = ?
    """, (feedback, timestamp, dpr_id))
    
    conn.commit()
    conn.close()
    print(f"✓ DPR {dpr_id} feedback updated")


def update_dpr_status(dpr_id: int, status: str, db_path: str = "data/dpr.db"):
    """Update the status of a DPR (accepted, rejected, pending, etc.)."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE dprs 
        SET status = ?
        WHERE id = ?
    """, (status, dpr_id))
    
    conn.commit()
    conn.close()
    print(f"✓ DPR {dpr_id} status updated to: {status}")


def validate_dpr_against_project(dpr_id: int, project_id: int, summary_json: dict, db_path: str = "data/dpr.db") -> dict:
    """
    Validate DPR against project requirements and return validation flags.
    Checks if DPR state and sector match the project.
    
    Args:
        dpr_id: DPR ID
        project_id: Project ID
        summary_json: Parsed DPR analysis JSON
        db_path: Database path
        
    Returns:
        Validation flags dict with hasFlags boolean and flags array
    """
    # Get project details
    project = get_project(project_id, db_path)
    if not project or not summary_json:
        return {"hasFlags": False, "flags": []}
    
    flags = []
    
    # Extract DPR state and sector
    dpr_state = summary_json.get("projectLocation", {}).get("state", "").strip()
    dpr_sector = summary_json.get("projectSector", "").strip()
    
    project_state = project.get("state", "").strip()
    project_sector = project.get("sector", "").strip()
    
    # Check state mismatch (case-insensitive)
    if dpr_state and project_state and dpr_state.lower() != project_state.lower():
        flags.append({
            "type": "state_mismatch",
            "message": f"DPR state ({dpr_state}) doesn't match project state ({project_state})",
            "severity": "warning"
        })
    
    # Check sector mismatch (case-insensitive)
    if dpr_sector and project_sector and dpr_sector.lower() != project_sector.lower():
        flags.append({
            "type": "sector_mismatch",
            "message": f"DPR sector ({dpr_sector}) doesn't match project sector ({project_sector})",
            "severity": "warning"
        })
    
    return {
        "hasFlags": len(flags) > 0,
        "flags": flags
    }




def delete_dpr(dpr_id: int, db_path: str = "data/dpr.db") -> Optional[str]:
    """
    Delete a DPR and all associated data.
    Returns the filepath of the deleted DPR so it can be removed from disk.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get filepath before deletion
    cursor.execute("SELECT filepath FROM dprs WHERE id = ?", (dpr_id,))
    row = cursor.fetchone()
    filepath = row[0] if row else None
    
    # Delete from messages (chat history)
    cursor.execute("DELETE FROM messages WHERE dpr_id = ?", (dpr_id,))
    
    # Delete from comparison_chat_pdfs (remove from comparisons)
    cursor.execute("DELETE FROM comparison_chat_pdfs WHERE dpr_id = ?", (dpr_id,))
    
    # Delete from dprs table
    cursor.execute("DELETE FROM dprs WHERE id = ?", (dpr_id,))
    
    conn.commit()
    conn.close()
    
    print(f"✓ Deleted DPR {dpr_id} from database")
    return filepath


def get_dpr(dpr_id: int, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a DPR by ID."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, filename, original_filename, filepath, uploaded_file_ref, 
               upload_ts, summary_json, project_id, status, client_id,
               admin_feedback, feedback_timestamp, validation_flags
        FROM dprs 
        WHERE id = ?
    """, (dpr_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        result = {
            "id": row["id"],
            "filename": row["filename"],
            "original_filename": row["original_filename"],
            "filepath": row["filepath"],
            "uploaded_file_ref": row["uploaded_file_ref"],
            "upload_ts": row["upload_ts"]
        }
        
        # Add client_id if it exists
        if "client_id" in row.keys():
            result["client_id"] = row["client_id"]
        
        # Add status if it exists
        if "status" in row.keys():
            result["status"] = row["status"]
        
        # Add feedback fields if they exist
        if "admin_feedback" in row.keys():
            result["admin_feedback"] = row["admin_feedback"]
        
        if "feedback_timestamp" in row.keys():
            result["feedback_timestamp"] = row["feedback_timestamp"]
        
        # Parse summary_json if it exists and is not None
        if row["summary_json"]:
            try:
                result["summary_json"] = json.loads(row["summary_json"])
            except:
                result["summary_json"] = None
        else:
            result["summary_json"] = None
        
        # Parse validation_flags if it exists and is not None
        if "validation_flags" in row.keys() and row["validation_flags"]:
            try:
                result["validation_flags"] = json.loads(row["validation_flags"])
            except:
                result["validation_flags"] = None
        else:
            result["validation_flags"] = None
            
        return result
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
            "summary_json": json.loads(row["summary_json"]) if row["summary_json"] else None
        }
    return None


def get_all_dprs(db_path: str = "data/dpr.db") -> List[Dict]:
    """Retrieve all DPRs with metadata."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT d.id, d.filename, d.original_filename, d.filepath, d.uploaded_file_ref, 
               d.upload_ts, d.summary_json, d.client_id, u.email as client_email
        FROM dprs d
        LEFT JOIN users u ON d.client_id = u.id
        ORDER BY d.upload_ts DESC
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
            "summary_json": json.loads(row["summary_json"]) if row["summary_json"] else None,
            "client_id": row["client_id"],
            "client_email": row["client_email"]
        }
        for row in rows
    ]


def get_processing_dprs(db_path: str = "data/dpr.db") -> List[Dict]:
    """Retrieve all DPRs that are still processing (summary_json is NULL)."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, filename, original_filename, filepath, uploaded_file_ref, upload_ts
        FROM dprs
        WHERE summary_json IS NULL OR summary_json = ''
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
            "upload_ts": row["upload_ts"]
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

# ===== COMPARISON CHAT FUNCTIONS =====

def create_comparison_chat(name: str, dpr_ids: List[int], db_path: str = "data/dpr.db") -> int:
    """Create a new comparison chat with associated DPRs."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    
    # Insert comparison chat
    cursor.execute("""
        INSERT INTO comparison_chats (name, created_ts)
        VALUES (?, ?)
    """, (name, timestamp))
    
    comparison_id = cursor.lastrowid
    
    # Link DPRs to this comparison
    for dpr_id in dpr_ids:
        cursor.execute("""
            INSERT INTO comparison_chat_pdfs (comparison_chat_id, dpr_id)
            VALUES (?, ?)
        """, (comparison_id, dpr_id))
    
    conn.commit()
    conn.close()
    
    print(f"✓ Comparison chat created with ID: {comparison_id} ({len(dpr_ids)} PDFs)")
    return comparison_id


def get_comparison_chat(comparison_id: int, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a comparison chat with its associated DPRs."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get comparison chat
    cursor.execute("""
        SELECT id, name, created_ts
        FROM comparison_chats WHERE id = ?
    """, (comparison_id,))
    
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    
    # Get associated DPRs
    cursor.execute("""
        SELECT d.id, d.filename, d.original_filename, d.filepath, 
               d.uploaded_file_ref, d.upload_ts, d.summary_json
        FROM dprs d
        JOIN comparison_chat_pdfs ccp ON d.id = ccp.dpr_id
        WHERE ccp.comparison_chat_id = ?
    """, (comparison_id,))
    
    dprs = [
        {
            "id": dpr["id"],
            "filename": dpr["filename"],
            "original_filename": dpr["original_filename"],
            "filepath": dpr["filepath"],
            "uploaded_file_ref": dpr["uploaded_file_ref"],
            "upload_ts": dpr["upload_ts"],
            "summary_json": json.loads(dpr["summary_json"])
        }
        for dpr in cursor.fetchall()
    ]
    
    conn.close()
    
    return {
        "id": row["id"],
        "name": row["name"],
        "created_ts": row["created_ts"],
        "dprs": dprs
    }


def get_all_comparison_chats(db_path: str = "data/dpr.db") -> List[Dict]:
    """Retrieve all comparison chats with metadata."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, name, created_ts
        FROM comparison_chats
        ORDER BY created_ts DESC
    """)
    
    chats = []
    for row in cursor.fetchall():
        comparison_id = row["id"]
        
        # Get count of PDFs in this comparison
        cursor.execute("""
            SELECT COUNT(*) as pdf_count
            FROM comparison_chat_pdfs
            WHERE comparison_chat_id = ?
        """, (comparison_id,))
        
        pdf_count = cursor.fetchone()["pdf_count"]
        
        # Get count of messages in this comparison
        cursor.execute("""
            SELECT COUNT(*) as message_count
            FROM comparison_messages
            WHERE comparison_chat_id = ?
        """, (comparison_id,))
        
        message_count = cursor.fetchone()["message_count"]
        
        chats.append({
            "id": row["id"],
            "name": row["name"],
            "created_ts": row["created_ts"],
            "dpr_count": pdf_count,
            "message_count": message_count
        })
    
    conn.close()
    return chats


def insert_comparison_message(comparison_id: int, role: str, text: str, db_path: str = "data/dpr.db"):
    """Insert a chat message for a comparison (role: 'user' or 'assistant')."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO comparison_messages (comparison_chat_id, role, text, timestamp)
        VALUES (?, ?, ?, ?)
    """, (comparison_id, role, text, timestamp))
    
    conn.commit()
    conn.close()


def get_comparison_messages(comparison_id: int, db_path: str = "data/dpr.db") -> List[Dict]:
    """Retrieve all chat messages for a comparison."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, comparison_chat_id, role, text, timestamp
        FROM comparison_messages
        WHERE comparison_chat_id = ?
        ORDER BY timestamp ASC
    """, (comparison_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": row["id"],
            "comparison_chat_id": row["comparison_chat_id"],
            "role": row["role"],
            "text": row["text"],
            "timestamp": row["timestamp"]
        }
        for row in rows
    ]


def clear_comparison_history(comparison_id: int, db_path: str = "data/dpr.db"):
    """Delete all chat messages for a specific comparison."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        DELETE FROM comparison_messages WHERE comparison_chat_id = ?
    """, (comparison_id,))
    
    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()
    
    print(f"✓ Cleared {deleted_count} messages for comparison chat {comparison_id}")
    return deleted_count


def delete_comparison_chat(comparison_id: int, db_path: str = "data/dpr.db"):
    """Delete a comparison chat and all associated data."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Delete messages
    cursor.execute("""
        DELETE FROM comparison_messages WHERE comparison_chat_id = ?
    """, (comparison_id,))
    
    # Delete PDF associations
    cursor.execute("""
        DELETE FROM comparison_chat_pdfs WHERE comparison_chat_id = ?
    """, (comparison_id,))
    
    # Delete the comparison chat itself
    cursor.execute("""
        DELETE FROM comparison_chats WHERE id = ?
    """, (comparison_id,))
    
    conn.commit()
    conn.close()
    print(f"✓ Deleted comparison chat {comparison_id}")


def add_dpr_to_comparison(comparison_id: int, dpr_id: int, db_path: str = "data/dpr.db") -> bool:
    """Add a DPR to an existing comparison."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if DPR is already in the comparison
        cursor.execute("""
            SELECT COUNT(*) FROM comparison_chat_pdfs 
            WHERE comparison_chat_id = ? AND dpr_id = ?
        """, (comparison_id, dpr_id))
        
        if cursor.fetchone()[0] > 0:
            conn.close()
            print(f"⚠ DPR {dpr_id} is already in comparison {comparison_id}")
            return False
        
        # Add the DPR to the comparison
        cursor.execute("""
            INSERT INTO comparison_chat_pdfs (comparison_chat_id, dpr_id)
            VALUES (?, ?)
        """, (comparison_id, dpr_id))
        
        conn.commit()
        conn.close()
        print(f"✓ Added DPR {dpr_id} to comparison {comparison_id}")
        return True
    except Exception as e:
        conn.close()
        print(f"✗ Failed to add DPR to comparison: {str(e)}")
        return False


def remove_dpr_from_comparison(comparison_id: int, dpr_id: int, db_path: str = "data/dpr.db") -> bool:
    """Remove a DPR from a comparison. Requires at least 2 DPRs to remain."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check current count of DPRs in comparison
        cursor.execute("""
            SELECT COUNT(*) FROM comparison_chat_pdfs 
            WHERE comparison_chat_id = ?
        """, (comparison_id,))
        
        current_count = cursor.fetchone()[0]
        
        if current_count <= 2:
            conn.close()
            print(f"⚠ Cannot remove DPR: comparison {comparison_id} must have at least 2 DPRs")
            return False
        
        # Remove the DPR from the comparison
        cursor.execute("""
            DELETE FROM comparison_chat_pdfs 
            WHERE comparison_chat_id = ? AND dpr_id = ?
        """, (comparison_id, dpr_id))
        
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        if deleted:
            print(f"✓ Removed DPR {dpr_id} from comparison {comparison_id}")
        else:
            print(f"⚠ DPR {dpr_id} was not in comparison {comparison_id}")
        
        return deleted
    except Exception as e:
        conn.close()
        print(f"✗ Failed to remove DPR from comparison: {str(e)}")
        return False


# ===== PROJECT FUNCTIONS =====

def get_projects(db_path: str = "data/dpr.db") -> List[Dict]:
    """Retrieve all projects with their DPR counts and comparison status."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT p.*, COUNT(d.id) as dpr_count
        FROM projects p
        LEFT JOIN dprs d ON p.id = d.project_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    projects = []
    for row in rows:
        project = dict(row)
        # Add has_comparison flag
        project['has_comparison'] = project.get('comparison_result') is not None
        projects.append(project)
    
    return projects


def create_project(name: str, state: str, scheme: str, sector: str, db_path: str = "data/dpr.db") -> int:
    """Create a new project."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO projects (name, state, scheme, sector, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (name, state, scheme, sector, timestamp))
    
    project_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(f"✓ Project created with ID: {project_id}")
    return project_id


def delete_project(project_id: int, db_path: str = "data/dpr.db") -> List[str]:
    """
    Delete a project and all its associated DPRs.
    Returns a list of filepaths that should be deleted from disk.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all DPR filepaths for this project before deletion
    cursor.execute("""
        SELECT filepath FROM dprs WHERE project_id = ?
    """, (project_id,))
    
    filepaths = [row[0] for row in cursor.fetchall()]
    
    # Get all DPR IDs for this project
    cursor.execute("""
        SELECT id FROM dprs WHERE project_id = ?
    """, (project_id,))
    
    dpr_ids = [row[0] for row in cursor.fetchall()]
    
    # Delete messages for each DPR
    for dpr_id in dpr_ids:
        cursor.execute("DELETE FROM messages WHERE dpr_id = ?", (dpr_id,))
        cursor.execute("DELETE FROM comparison_chat_pdfs WHERE dpr_id = ?", (dpr_id,))
    
    # Delete all DPRs in this project
    cursor.execute("""
        DELETE FROM dprs WHERE project_id = ?
    """, (project_id,))
    
    # Delete the project itself
    cursor.execute("""
        DELETE FROM projects WHERE id = ?
    """, (project_id,))
    
    conn.commit()
    conn.close()
    
    print(f"✓ Deleted project {project_id} and {len(dpr_ids)} associated DPRs")
    return filepaths


def get_project(project_id: int, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Get project details with comparison status."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        project = dict(row)
        # Add has_comparison flag
        project['has_comparison'] = project.get('comparison_result') is not None
        return project
    return None


def get_dprs_by_project(project_id: int, db_path: str = "data/dpr.db") -> List[Dict]:
    """Get all DPRs for a specific project."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT d.id, d.filename, d.original_filename, d.upload_ts, d.summary_json, 
               d.project_id, d.status, d.client_id, d.validation_flags, u.email as client_email
        FROM dprs d
        LEFT JOIN users u ON d.client_id = u.id
        WHERE d.project_id = ?
        ORDER BY d.upload_ts DESC
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
        
        if dpr.get('validation_flags'):
            try:
                dpr['validation_flags'] = json.loads(dpr['validation_flags'])
            except:
                dpr['validation_flags'] = None
        
        dprs.append(dpr)
        
    return dprs


def save_project_comparison(project_id: int, comparison_json: dict, db_path: str = "data/dpr.db") -> None:
    """Save comparison result for a project."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    json_str = json.dumps(comparison_json, indent=2)
    
    cursor.execute("""
        UPDATE projects 
        SET comparison_result = ?, comparison_generated_at = ?
        WHERE id = ?
    """, (json_str, timestamp, project_id))
    
    conn.commit()
    conn.close()
    print(f"✓ Saved comparison result for project {project_id}")


def get_project_comparison(project_id: int, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve saved comparison result for a project."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT comparison_result, comparison_generated_at
        FROM projects 
        WHERE id = ?
    """, (project_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row and row["comparison_result"]:
        return {
            "comparison": json.loads(row["comparison_result"]),
            "generated_at": row["comparison_generated_at"]
        }
    return None


def clear_project_comparison(project_id: int, db_path: str = "data/dpr.db") -> None:
    """Clear/reset comparison result for a project."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE projects 
        SET comparison_result = NULL, comparison_generated_at = NULL
        WHERE id = ?
    """, (project_id,))
    
    conn.commit()
    conn.close()
    print(f"✓ Cleared comparison result for project {project_id}")


# ===== USER AUTHENTICATION FUNCTIONS =====

def create_user(email: str, password_hash: str, name: str = None, username: str = None, db_path: str = "data/dpr.db") -> int:
    """Create a new user and return the user ID."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    
    try:
        cursor.execute("""
            INSERT INTO users (email, password_hash, name, username, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (email, password_hash, name, username, timestamp))
        
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        print(f"✓ User created with ID: {user_id}")
        return user_id
    except sqlite3.IntegrityError as e:
        conn.close()
        if 'email' in str(e) or 'UNIQUE' in str(e):
            raise ValueError("Email already exists")
        else:
            raise ValueError("User creation failed")


def get_user_by_username(username: str, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a user by username."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, email, password_hash, name, created_at
        FROM users WHERE username = ?
    """, (username,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "password_hash": row["password_hash"],
            "name": row["name"],
            "created_at": row["created_at"]
        }
    return None


def get_user_by_email(email: str, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a user by email."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, email, password_hash, name, created_at
        FROM users WHERE email = ?
    """, (email,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row["id"],
            "username": row["username"] if "username" in row.keys() else None,
            "email": row["email"],
            "password_hash": row["password_hash"],
            "name": row["name"],
            "created_at": row["created_at"]
        }
    return None


def get_user_by_email(email: str, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a user by email."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, email, password_hash, created_at
        FROM users WHERE email = ?
    """, (email,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "password_hash": row["password_hash"],
            "created_at": row["created_at"]
        }
    return None


def get_user_by_username_or_email(identifier: str, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a user by username or email."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, email, password_hash, created_at
        FROM users WHERE username = ? OR email = ?
    """, (identifier, identifier))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "password_hash": row["password_hash"],
            "created_at": row["created_at"]
        }
    return None


def get_user_by_email(email: str, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a user by email."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, email, password_hash, name, created_at
        FROM users WHERE email = ?
    """, (email,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row["id"],
            "username": row["username"] if "username" in row.keys() else None,
            "email": row["email"],
            "password_hash": row["password_hash"],
            "name": row["name"],
            "created_at": row["created_at"]
        }
    return None


# ===== CLIENT DPR FUNCTIONS =====

def create_client_dpr(client_id: int, project_name: str, filename: str, original_filename: str, db_path: str = "data/dpr.db") -> int:
    """Create a new client DPR record and return its ID."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    timestamp = datetime.now().isoformat()
    status = "Review"
    
    cursor.execute("""
        INSERT INTO client_dprs (client_id, project_name, dpr_filename, original_filename, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (client_id, project_name, filename, original_filename, status, timestamp))
    
    dpr_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(f"✓ Client DPR created with ID: {dpr_id} for client {client_id}")
    return dpr_id


def get_client_dprs(client_id: int, db_path: str = "data/dpr.db") -> List[Dict]:
    """Retrieve all DPRs for a specific client."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, client_id, project_name, dpr_filename, original_filename, status, created_at
        FROM client_dprs
        WHERE client_id = ?
        ORDER BY created_at DESC
    """, (client_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def get_client_dpr(dpr_id: int, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a specific client DPR by ID."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, client_id, project_name, dpr_filename, original_filename, status, created_at
        FROM client_dprs
        WHERE id = ?
    """, (dpr_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None

