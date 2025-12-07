# Cloud Backend - PDF Project Manager

Minimal FastAPI backend for cloud-based PDF storage and project management.

## Purpose

This is the cloud component of a hybrid offline/online PDF analysis system:
- **Clients** upload PDFs here (even when admin is offline)
- **Admin** syncs local changes with this cloud backend
- **No AI processing** - just storage and sync (admin does AI locally)

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
# OR
uvicorn main:app --reload --port 8001
```

Server runs on http://localhost:8001

## API Endpoints

### Health Check
- `GET /ping` - Check if server is online

### Projects
- `GET /projects` - List all projects (optional: `?since=<timestamp>`)
- `POST /projects` - Create new project
- `PUT /projects/{id}` - Update project
- `GET /projects/{id}` - Get project with files

### Files
- `POST /projects/{id}/upload_pdf` - Upload PDF to project
- `GET /files` - List all files (optional: `?since=<timestamp>`)
- `GET /files/{id}` - Get file metadata
- `DELETE /files/{id}` - Delete file

### Sync (Admin)
- `POST /sync/projects/batch` - Batch sync projects from admin

## Deployment to Render

1. Push to GitHub
2. Create new Web Service on Render
3. Connect to your GitHub repository
4. Select `cloud_backend` as root directory (or set build command)
5. Render will auto-detect the Procfile
6. Deploy!

Environment variables: None required (uses SQLite)

## Database

Uses SQLite (`data/cloud.db`) with two tables:
- `projects` - Project metadata
- `files` - Uploaded PDF files metadata

Data persists in `data/` directory on server.
