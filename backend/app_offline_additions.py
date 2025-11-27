# New upload endpoint with offline support
# This file contains the modified upload and sync logic to add to app.py

import asyncio

# Add these imports at the top of app.py:
# import backend.db_offline_utils as db_offline
# from backend.offline_engine import OfflineAnalyzer

# Global offline analyzer instance (initialize in lifespan)
# offline_analyzer = None

def check_internet_connectivity() -> bool:
    """Check if internet is available by trying to reach Google."""
    try:
        import urllib.request
        urllib.request.urlopen('https://www.google.com', timeout=3)
        return True
    except:
        return False


# Modified lifespan to include offline analyzer initialization and sync task
@asynccontextmanager
async def lifespan_with_offline(app: FastAPI):
    """
    Lifespan context manager with offline analyzer and sync support.
    """
    import asyncio
    global offline_analyzer
    
    # Initialize offline analyzer
    offline_analyzer = OfflineAnalyzer()
    print("✓ Offline analyzer initialized")
    
    async def resume_processing():
        print("⏳ Checking for interrupted DPR processing...")
        processing_dprs = await asyncio.to_thread(db.get_processing_dprs)
        
        if not processing_dprs:
            print("✓ No interrupted DPRs found.")
            return
            
        print(f"⚠ Found {len(processing_dprs)} interrupted DPRs. Resuming processing...")
        
        for dpr in processing_dprs:
            dpr_id = dpr['id']
            filename = dpr['filename']
            file_ref = dpr['uploaded_file_ref']
            
            print(f"▶ Resuming analysis for DPR {dpr_id} ({filename})...")
            
            try:
                multilang_json = await gemini_client.generate_multilang_json_from_file(file_ref, str(SCHEMA_PATH))
                parsed_json = multilang_json.get("en", multilang_json)
                await asyncio.to_thread(db.update_dpr, dpr_id, parsed_json, multilang_json)
                print(f"✓ Completed analysis for DPR {dpr_id}")
            except Exception as e:
                print(f"✗ Failed to resume analysis for DPR {dpr_id}: {str(e)}")
    
    # Background task for syncing offline DPRs
    async def sync_offline_dprs():
        while True:
            await asyncio.sleep(60)  # Check every 60 seconds
            
            if not check_internet_connectivity():
                continue
            
            pedning_dprs = await asyncio.to_thread(db_offline.get_pending_sync_dprs)
            
            if not pending_dprs:
                continue
            
            print(f"🌐 Internet available! Syncing {len(pending_dprs)} offline DPRs...")
            
            for dpr in pending_dprs:
                dpr_id = dpr['id']
                filepath = dpr['filepath']
                
                try:
                    # Re-upload file
                    file_ref = await gemini_client.upload_file(filepath)
                    await asyncio.to_thread(db.update_dpr_file_ref, dpr_id, file_ref)
                    
                    # Generate full analysis
                    multilang_json = await gemini_client.generate_multilang_json_from_file(file_ref, str(SCHEMA_PATH))
                    parsed_json = multilang_json.get("en", multilang_json)
                    
                    # Update database
                    await asyncio.to_thread(db.update_dpr, dpr_id, parsed_json, multilang_json)
                    await asyncio.to_thread(db_offline.mark_dpr_synced, dpr_id)
                    
                    print(f"✓ Synced DPR {dpr_id}")
                except Exception as e:
                    print(f"✗ Failed to sync DPR {dpr_id}: {str(e)}")
    
    # Start background tasks
    asyncio.create_task(resume_processing())
    asyncio.create_task(sync_offline_dprs())
    
    yield
    # Shutdown logic


# New upload endpoint with offline fallback
@app.post("/upload-dpr-hybrid")
async def upload_dpr_hybrid(
    file: UploadFile = File(...), 
    language: str = Form("en"),
    project_id: Optional[int] = Form(None)
):
    """
    Upload a DPR PDF. Tries Gemini first, falls back to offline if no internet.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    try:
        original_filename = file.filename
        
        # Check for existing
        existing_dpr = db.get_dpr_by_filename(original_filename)
        if existing_dpr:
            return JSONResponse({
                "id": existing_dpr["id"],
                "dpr_id": existing_dpr["id"],
                "summary": existing_dpr["summary_json"],
                "is_offline": existing_dpr.get("is_offline", False),
                "existing": True
            })
        
        # Save file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"{timestamp}_{unique_id}_{original_filename}"
        filepath = DATA_DIR / filename
        
        with open(filepath, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Try online first
        has_internet = check_internet_connectivity()
        
        if has_internet:
            try:
                print("🌐 Internet available - using Gemini")
                file_ref = await gemini_client.upload_file(str(filepath))
                
                # Insert initial record
                dpr_id = db.insert_dpr(
                    filename=filename,
                    original_filename=original_filename,
                    filepath=str(filepath),
                    file_ref=file_ref,
                    summary_json=None,
                    summary_json_multilang=None,
                    project_id=project_id,
                    is_offline=False
                )
                
                # Generate analysis
                multilang_json = await gemini_client.generate_multilang_json_from_file(file_ref, str(SCHEMA_PATH))
                parsed_json = multilang_json.get(language, multilang_json["en"])
                db.update_dpr(dpr_id, parsed_json, multilang_json)
                
                return JSONResponse({
                    "id": dpr_id,
                    "dpr_id": dpr_id,
                    "summary": parsed_json,
                    "is_offline": False,
                    "existing": False
                })
            except Exception as e:
                print(f"✗ Gemini failed: {e}. Falling back to offline mode.")
                has_internet = False
        
        # Offline mode
        if not has_internet:
            print("📴 No internet - using offline analyzer")
            
            # Insert record with offline flag
            dpr_id = db.insert_dpr(
                filename=filename,
                original_filename=original_filename,
                filepath=str(filepath),
                file_ref="offline",
                summary_json={},
                project_id=project_id,
                is_offline=True,
                processing_status="Starting offline analysis..."
            )
            
            # Progress callback
            def progress_callback(status: str, partial_data: dict):
                db_offline.update_dpr_processing_status(dpr_id, status)
                if partial_data:
                    db_offline.update_dpr_partial_analysis(dpr_id, partial_data)
            
            # Run offline analysis in background
            async def run_offline_analysis():
                try:
                    analysis = await asyncio.to_thread(
                        offline_analyzer.process_pdf_offline,
                        str(filepath),
                        dpr_id,
                        progress_callback
                    )
                    db.update_dpr(dpr_id, analysis, None)
                    db_offline.update_dpr_processing_status(dpr_id, "Complete")
                except Exception as e:
                    print(f"✗ Offline analysis failed: {e}")
                    db_offline.update_dpr_processing_status(dpr_id, f"Error: {str(e)}")
            
            asyncio.create_task(run_offline_analysis())
            
            return JSONResponse({
                "id": dpr_id,
                "dpr_id": dpr_id,
                "summary": {},
                "is_offline": True,
                "processing": True,
                "existing": False
            })
    
    except Exception as e:
        print(f"✗ Upload error: {str(e)}\")\n        raise HTTPException(status_code=500, detail=f\"Failed to process DPR: {str(e)}")


# Status endpoint
@app.get("/dpr/{dpr_id}/status")
async def get_dpr_status(dpr_id: int):
    """Get processing status of a DPR."""
    dpr = db.get_dpr(dpr_id)
    if not dpr:
        raise HTTPException(status_code=404, detail=f"DPR {dpr_id} not found")
    
    return JSONResponse({
        "dpr_id": dpr_id,
        "is_offline": dpr.get("is_offline", False),
        "processing_status": dpr.get("processing_status"),
        "sync_status": dpr.get("sync_status", "synced"),
        "summary_json": dpr.get("summary_json")
    })
