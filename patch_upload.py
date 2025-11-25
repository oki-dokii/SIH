#!/usr/bin/env python3
"""
Emergency patch to fix upload endpoint - allows uploads to succeed even if Gemini analysis fails
"""

import re

APP_PY_PATH = "backend/app.py"

# Read the file
with open(APP_PY_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the error handling in upload_dpr function
# Pattern: the except block that raises the error
old_pattern = r'''        except Exception as e:
            print\(f"✗ Analysis failed: \{str\(e\)\}"\)
            # Optional: db\.delete_dpr\(dpr_id\)
            raise e'''

new_code = '''        except Exception as e:
            print(f"✗ Analysis failed: {str(e)}")
            # CRITICAL FIX: Don't fail the upload, just mark as analysis failed
            print(f"⚠ Upload succeeded but analysis failed. DPR {dpr_id} saved without analysis.")
            
            return JSONResponse({
                "id": dpr_id,
                "dpr_id": dpr_id,
                "summary": None,
                "existing": False,
                "status": "analysis_failed",
                "error": str(e)[:200]
            })'''

# Replace
content_new = re.sub(old_pattern, new_code, content, flags=re.MULTILINE)

if content_new == content:
    print("❌ Pattern not found - file may have changed")
    print("Looking for the pattern...")
    if "raise e" in content and "Analysis failed" in content:
        print("✓ Found similar code, but pattern doesn't match exactly")
        print("Manual fix needed")
    exit(1)

# Write back
with open(APP_PY_PATH, 'w', encoding='utf-8') as f:
    f.write(content_new)

print("✅ Successfully patched backend/app.py")
print("Upload will now succeed even if Gemini analysis fails")
