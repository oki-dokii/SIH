"""
Comprehensive script to add offline fallback to app.py
Makes ALL changes in one go, safely
"""

import re

print("Reading backend/app.py...")
with open("backend/app.py", "r", encoding="utf-8") as f:
    content = f.read()

# Backup
with open("backend/app.py.backup", "w", encoding="utf-8") as f:
    f.write(content)
print("✅ Backup created: backend/app.py.backup")

# 1. Add imports
if "import shutil" not in content:
    content = content.replace(
        "import uuid",
        "import uuid\nimport shutil\nimport urllib.request"
    )
    print("✅ Added shutil and urllib imports")

if "BackgroundTasks" not in content:
    content = content.replace(
        "from fastapi import FastAPI, File, Form, UploadFile, HTTPException",
        "from fastapi import FastAPI, File, Form, UploadFile, HTTPException, BackgroundTasks"
    )
    print("✅ Added BackgroundTasks import")

if "from backend.offline_engine import OfflineAnalyzer" not in content:
    content = content.replace(
        "import backend.report_generator as report_generator",
        """import backend.report_generator as report_generator
import backend.db_offline as db_offline
from backend.offline_engine import OfflineAnalyzer"""
    )
    print("✅ Added offline_engine imports")

# 2. Add global and helper function
if "offline_analyzer = None" not in content:
    content = content.replace(
        'db.init_db(str(DATA_DIR / "dpr.db"))',
        '''db.init_db(str(DATA_DIR / "dpr.db"))

# Global Offline Analyzer instance
offline_analyzer = None

def check_internet_connectivity() -> bool:
    """Check if internet is available by pinging a reliable host."""
    try:
        urllib.request.urlopen('https://www.google.com', timeout=3)
        return True
    except:
        return False'''
    )
    print("✅ Added offline_analyzer global and check_internet_connectivity()")

# 3. Initialize OfflineAnalyzer in lifespan
if "offline_analyzer = OfflineAnalyzer()" not in content:
    content = content.replace(
        '''async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    On startup, check for interrupted DPRs and resume processing in background.
    """
    import asyncio''',
        '''async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    On startup, check for interrupted DPRs and resume processing in background.
    """
    import asyncio
    global offline_analyzer
    
    # Initialize Offline Analyzer
    print("📦 Initializing Offline Analyzer...")
    offline_analyzer = OfflineAnalyzer()'''
    )
    print("✅ Added OfflineAnalyzer initialization in lifespan")

# 4. Add offline fallback to upload_dpr
# Find the Gemini upload section and wrap in try-except
if "Falling back to OFFLINE mode" not in content:
    # Pattern: from "# Upload to Gemini" to "db.update_dpr(dpr_id, parsed_json, multilang_json)"
    pattern = r'(        # Upload to Gemini Files API.*?)(        db\.update_dpr\(dpr_id, parsed_json, multilang_json\))'
    
    replacement = r'''\1        db.update_dpr(dpr_id, parsed_json, multilang_json)
        
        except Exception as online_error:
            # OFFLINE FALLBACK
            print(f"⚠ Online analysis failed: {str(online_error)}")
            print("🛡 Falling back to OFFLINE mode...")
            
            if offline_analyzer is None:
                raise HTTPException(status_code=503, detail="Offline analyzer not available")
            
            # Mark as offline
            import sqlite3
            conn = sqlite3.connect(str(DATA_DIR / "dpr.db"))
            cursor = conn.cursor()
            cursor.execute("UPDATE dprs SET uploaded_file_ref = ?, is_offline = ? WHERE id = ?",
                         ("offline", 1, dpr_id))
            conn.commit()
            conn.close()
            
            # Start offline analysis
            import asyncio
            asyncio.create_task(offline_analyzer.analyze_dpr(dpr_id, str(filepath)))
            
            return JSONResponse({
                "id": dpr_id,
                "dpr_id": dpr_id,
                "summary": {},
                "existing": False,
                "is_offline": True,
                "status": "processing"
            })'''
    
    # Add try before the Gemini upload
    content = re.sub(
        r'(        # Upload to Gemini Files API\r?\n)',
        r'\1        try:\n',
        content,
        count=1
    )
    
    # Add except after db.update_dpr
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    print("✅ Added offline fallback try-except to upload_dpr")

# 5. Add background sync task in lifespan
if "async def sync_offline_dprs():" not in content:
    # Find the location after resume_processing function
    sync_task = '''
    
    async def sync_offline_dprs():
        """Sync offline DPRs when internet returns."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                if not check_internet_connectivity():
                    continue
                
                pending_dprs = db_offline.get_pending_sync_dprs()
                if not pending_dprs:
                    continue
                
                print(f"🌐 Internet back! Syncing {len(pending_dprs)} offline DPRs...")
                
                for dpr in pending_dprs:
                    try:
                        dpr_id = dpr['id']
                        filepath = dpr['filepath']
                        
                        print(f"🔄 Re-analyzing DPR {dpr_id}...")
                        
                        file_ref = await gemini_client.upload_file(filepath)
                        multilang_json = await gemini_client.generate_multilang_json_from_file(
                            file_ref, str(SCHEMA_PATH))
                        
                        parsed_json = multilang_json.get("en", multilang_json)
                        await asyncio.to_thread(db.update_dpr, dpr_id, parsed_json, multilang_json)
                        await asyncio.to_thread(db_offline.mark_dpr_synced, dpr_id)
                        
                        print(f"✅ Synced DPR {dpr_id}")
                    except Exception as e:
                        print(f"✗ Failed to sync DPR {dpr_id}: {e}")
                        
            except Exception as e:
                print(f"✗ Sync task error: {e}")
                await asyncio.sleep(60)'''
    
    content = content.replace(
        "    # Start the background task\n    asyncio.create_task(resume_processing())",
        sync_task + "\n\n    # Start the background tasks\n    asyncio.create_task(resume_processing())\n    asyncio.create_task(sync_offline_dprs())"
    )
    print("✅ Added background sync task")

# Write the modified content
with open("backend/app.py", "w", encoding="utf-8") as f:
    f.write(content)

print("\n🎉 All changes applied successfully!")
print("📝 Backup saved to: backend/app.py.backup")
print("\n Next: Restart the backend server to test")
