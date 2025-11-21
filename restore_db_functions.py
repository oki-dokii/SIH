
# Append comparison functions to db.py

comparison_functions = '''

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
            "pdf_count": pdf_count,
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
'''

# Read existing db.py
with open('backend/db.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Append comparison functions if not already there
if 'def get_all_comparison_chats' not in content:
    content += comparison_functions
    with open('backend/db.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Added all comparison functions to db.py!")
else:
    print("ℹ️ Comparison functions already exist in db.py")
