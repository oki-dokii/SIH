"""
Script to add offline fallback to upload_dpr and add background sync
"""

with open("backend/app.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the upload_dpr function and modify it

new_lines = []
in_upload_dpr = False
found_gemini_upload = False
indent_level = 0

for i, line in enumerate(lines):
    # Detect start of upload_dpr function
    if "@app.post(\"/upload-dpr\")" in line or "async def upload_dpr(" in line:
        in_upload_dpr = True
    
    # Wrap Gemini upload in try-catch with offline fallback
    if in_upload_dpr and "# Upload to Gemini Files API" in line:
        found_gemini_upload = True
        # Add try block before Gemini upload
        new_lines.append(line)  # Keep the comment
        new_lines.append("        try:\n")
        new_lines.append( "            # Try online mode first\n")
        continue
    
    # After the multilang_json update block, add except for offline fallback
    if found_gemini_upload and "db.update_dpr(dpr_id, parsed_json, multilang_json)" in line:
        new_lines.append(line)
        # Add except block for offline fallback
        new_lines.append("""        
        except Exception as online_error:
            # OFFLINE FALLBACK - connection failed or Gemini error
            print(f"⚠ Online analysis failed: {str(online_error)}")
            print("🛡 Falling back to OFFLINE mode...")
            
            if offline_analyzer is None:
                print("✗ Offline analyzer not initialized")
                raise HTTPException(status_code=503, detail=\"Online analysis failed and offline analyzer not available\")
            
            # Mark as offline and use local LLM
            import sqlite3
            conn = sqlite3.connect(str(DATA_DIR / \"dpr.db\"))
            cursor = conn.cursor()
            cursor.execute(\"UPDATE dprs SET uploaded_file_ref = ?, is_offline = ? WHERE id = ?\", (\"offline\", 1, dpr_id))
            conn.commit()
            conn.close()
            
            # Start offline analysis  
            import asyncio
            asyncio.create_task(offline_analyzer.analyze_dpr(dpr_id, str(filepath)))
            
            print(f\"🛡 Started offline analysis for DPR {dpr_id}\")
            
            return JSONResponse({
                \"id\": dpr_id,
                \"dpr_id\": dpr_id,
                \"summary\": {},
                \"existing\": False,
                \"is_offline\": True,
                \"status\": \"processing\"
            })
        
""")
        found_gemini_upload = False
        in_upload_dpr = False
        continue
    
    new_lines.append(line)

# Write back
with open("backend/app.py", "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("✅ Added offline fallback to upload_dpr")
