# Online Server Sync Integration Guide

## Files to Copy to SIH-first Project

Copy these 2 files from `RAG/` to your `SIH-first/` project:

1. **sync_manager.py** - Handles all sync operations
2. **add_sync_to_online.py** - Database migration script (below)

---

## Step-by-Step Instructions

### 1. Copy Sync Files

```bash
# From RAG folder, copy to SIH-first
cd "C:\Users\Aangir Doshi\OneDrive\Desktop\RAG"
Copy-Item "sync_manager.py" -Destination "C:\Users\Aangir Doshi\OneDrive\Desktop\SIH-first\"
```

### 2. Run Database Migration

```bash
cd "C:\Users\Aangir Doshi\OneDrive\Desktop\SIH-first"
python add_sync_to_online.py
```

This will add sync columns to your database.

### 3. Update .env File

Add this line to your `.env` file:
```
CLOUD_BACKEND_URL=https://rag-sync.onrender.com
```

### 4. Initialize Sync in Your Server

In your main server file (probably `app.py` or `server.py`), add:

```python
# At the top with other imports
import os
from dotenv import load_dotenv

load_dotenv()

# After your FastAPI app initialization
CLOUD_BACKEND_URL = os.getenv("CLOUD_BACKEND_URL")

if CLOUD_BACKEND_URL:
    try:
        from sync_manager import SyncManager
        DB_PATH = "your_database_path.db"  # Update this!
        
        sync_manager = SyncManager(CLOUD_BACKEND_URL, DB_PATH)
        sync_manager.start_auto_sync()
        
        print(f"✅ Sync enabled with cloud: {CLOUD_BACKEND_URL}")
    except Exception as e:
        print(f"⚠️ Failed to initialize sync: {e}")
else:
    print("ℹ️ Sync disabled (CLOUD_BACKEND_URL not set)")
```

### 5. Update Create/Delete Operations

**When creating projects:**
```python
# After creating a project
project_id = db.create_project(...)

# Mark as dirty for sync
cursor.execute("UPDATE projects SET dirty = 1 WHERE id = ?", (project_id,))
```

**When deleting projects:**
```python
# Instead of hard delete, use soft delete
from db import soft_delete_project_local  # If you have this function
soft_delete_project_local(project_id)

# Or directly:
cursor.execute("""
    UPDATE projects 
    SET deleted = 1, deleted_at = datetime('now'), dirty = 1
    WHERE id = ?
""", (project_id,))
```

### 6. Test the Sync

1. Start your online server
2. Create a new project
3. Wait 30 seconds
4. Check offline server (port 8001) - project should appear
5. Delete a project in offline server
6. Wait 30 seconds
7. Check online server - project should disappear

---

## What Gets Synced

**Synced fields:**
- Project: id, name, state, scheme, sector, created_ts
- DPR: id, project_id, filename, original_filename, upload_ts

**NOT synced (local only):**
- Analysis results
- Processing status
- File paths
- Chunks/vectors

---

## Troubleshooting

**Sync not working?**
1. Check `.env` has `CLOUD_BACKEND_URL`
2. Check server logs for sync messages
3. Verify database has sync columns: `SELECT * FROM sqlite_master WHERE type='table'`
4. Test cloud connection: `curl https://rag-sync.onrender.com/ping`

**Projects not appearing?**
- Check `deleted = 0` in your queries
- Verify `dirty` flag is being set when creating

**Manual sync:**
```python
sync_manager.full_sync()  # Force sync now
```
