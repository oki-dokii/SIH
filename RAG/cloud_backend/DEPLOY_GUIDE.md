# Cloud Backend Deployment Guide

## Deploy Updated Backend to Render

### Changes Made:
1. ✅ Added `DELETE /projects/{project_id}` endpoint
2. ✅ Added `delete_project()` function to database module
3. ✅ Created cleanup script for stale projects

### Deployment Steps:

**1. Commit and Push Changes:**
```bash
cd cloud_backend
git add .
git commit -m "Add project deletion endpoint and cleanup script"
git push
```

**2. Run Cleanup Script on Render:**

After deployment, access your Render shell and run:
```bash
python cleanup_cloud_db.py
```

This will remove the stale projects "yt" and "trdtdkj".

**Or manually via Render Dashboard:**
- Go to Render Dashboard → Shell
- Run:
```python
import sqlite3
conn = sqlite3.connect('data/cloud.db')
c = conn.cursor()
c.execute("DELETE FROM projects WHERE name IN ('yt', 'trdtdkj')")
print(f"Deleted {c.rowcount} projects")
conn.commit()
conn.close()
```

### Test DELETE Endpoint:

Once deployed, test with:
```bash
curl -X DELETE https://rag-sync.onrender.com/projects/1
```

Expected response:
```json
{"message": "Project deleted successfully"}
```

### Offline Sync Update:

The offline version will now:
- ✅ Fetch projects from Render
- ✅ Detect deleted projects (missing from cloud)
- ⚠️ Need to implement delete sync in `sync_manager.py` to remove local projects when deleted from cloud

---

## Files Modified:

1. **cloud_backend/database.py** - Added `delete_project()` function
2. **cloud_backend/main.py** - Added `DELETE /projects/{id}` endpoint
3. **cloud_backend/cleanup_cloud_db.py** - New cleanup script
