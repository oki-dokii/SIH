# Online Version - Changes Required

## Quick Setup Summary

You need to add **ONE endpoint** to upload PDFs to Render cloud when users upload them.

---

## 1. Add to Online Version Backend

### Endpoint to Add:

```python
import requests
import hashlib

@app.post("/projects/{project_id}/upload_pdf")
async def upload_pdf_to_cloud(project_id: int, file: UploadFile):
    """Upload PDF to Render cloud after Gemini processing."""
    
    # 1. Process with Gemini (your existing code)
    # ... your Gemini processing code ...
    
    # 2. Upload to Render cloud
    try:
        # Read file content
        file_content = await file.read()
        
        # Upload to Render
        files = {'file': (file.filename, file_content, 'application/pdf')}
        data = {
            'project_id': project_id,
            'original_filename': file.filename
        }
        
        response = requests.post(
            f"{RENDER_CLOUD_URL}/projects/{project_id}/upload_pdf",
            files=files,
            data=data,
            timeout=60
        )
        
        if response.status_code == 200:
            print(f"✅ Synced to cloud: {file.filename}")
        
    except Exception as e:
        print(f"⚠️ Failed to sync to cloud: {e}")
        # Don't fail - cloud sync is optional
    
    return {"message": "PDF uploaded"}
```

### Environment Variable:

Add to your online version's `.env` file:
```
RENDER_CLOUD_URL=https://rag-sync.onrender.com
```

---

## 2. Add to Online Version - Project Creation

When creating projects, also push to Render:

```python
def create_project(name, state, scheme, sector):
    # 1. Create in online database
    project_id = db.create_project(name, state, scheme, sector)
    
    # 2. Sync to Render cloud
    try:
        response = requests.post(
            f"{RENDER_CLOUD_URL}/projects",
            json={
                "name": name,
                "state": state,
                "scheme": scheme,
                "sector": sector
            }
        )
        cloud_id = response.json()['id']
        print(f"✅ Project synced to cloud: {cloud_id}")
    except:
        print("⚠️ Cloud sync failed")
    
    return project_id
```

---

## That's It!

The offline version will automatically:
- Fetch projects from Render
- Download PDFs
- Let users analyze with local LLM

**Two endpoints needed in online version:**
1. Sync projects when created → `POST /projects`
2. Sync PDFs when uploaded → `POST /projects/{id}/upload_pdf`
