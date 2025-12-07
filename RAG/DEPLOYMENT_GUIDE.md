# Deployment Guide - Cloud Backend on Render

## Prerequisites
- GitHub account
- Render account (free at https://render.com)
- Your code pushed to GitHub

## Step-by-Step Deployment

### 1. Prepare Your Repository

Make sure your `cloud_backend/` folder is committed and pushed to GitHub:

```bash
cd "c:\Users\Aangir Doshi\OneDrive\Desktop\RAG"
git add cloud_backend/
git commit -m "Add cloud backend for PDF sync"
git push origin main
```

### 2. Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +" → "Web Service"**
3. Connect your GitHub repository
4. Click **"Connect"** next to your repository

### 3. Configure Service

**Basic Settings:**
- **Name**: `pdf-cloud-backend` (or any name you like)
- **Region**: Choose closest to you
- **Branch**: `main` (or your branch name)
- **Root Directory**: `cloud_backend`
- **Runtime**: `Python 3`

**Build & Deploy:**
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

> **Note**: Render will auto-detect the `Procfile`, so start command should work automatically

**Pricing:**
- Select **"Free"** plan

### 4. Deploy

1. Click **"Create Web Service"**
2. Wait for deployment to complete (2-5 minutes)
3. You'll see: ✅ **"Live"** when ready

### 5. Get Your Cloud URL

After deployment, you'll see your service URL:
```
https://pdf-cloud-backend-XXXX.onrender.com
```

Copy this URL - you'll need it for the admin app!

### 6. Test Your Deployment

Open a terminal and test the health check:

```bash
curl https://your-app-name.onrender.com/ping
```

Expected response:
```json
{"status": "ok", "timestamp": "2025-12-08T00:00:00"}
```

If you see this, your cloud backend is **LIVE**! 🎉

## Configure Admin App to Sync

On your admin machine (laptop), create a `.env` file:

```bash
# File: RAG/.env
CLOUD_BACKEND_URL=https://your-app-name.onrender.com
```

Then restart your admin server:

```bash
python server.py
```

You should see:
```
✅ Sync enabled with cloud: https://your-app-name.onrender.com
🤖 Auto-sync worker started (interval: 30s)
```

## Testing the Complete Flow

### Test 1: Client Uploads PDF

From any device, open: `https://your-app-name.onrender.com/docs`

Use the Swagger UI to:
1. Create a project (POST `/projects`)
2. Upload a PDF (POST `/projects/{id}/upload_pdf`)

### Test 2: Admin Syncs Down

On admin machine, wait 30 seconds (or trigger manual sync) and check:
- Projects list should show the cloud project
- PDFs should appear in the project

### Test 3: Admin Creates Project

On admin machine:
1. Create a new project
2. Wait for sync
3. Check Render logs - you should see the project synced

## Troubleshooting

### Deployment Failed

**Check Build Logs** on Render dashboard:
- Make sure `requirements.txt` exists in `cloud_backend/`
- Check for Python version compatibility

### Can't Reach /ping

- Check service status on Render (should be green "Live")
- Make sure URL is correct (copy from Render dashboard)
- Free tier may sleep after inactivity - first request wakes it up (takes 30s)

### Sync Not Working

On admin machine:
```bash
# Check if CLOUD_BACKEND_URL is set
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('CLOUD_BACKEND_URL'))"
```

If it prints `None`, your `.env` file isn't being loaded.

## Important Notes

### Free Tier Limitations (Render)
- Service sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- 750 hours/month free (enough for testing/demo)
- SQLite database resets on service restart (upgrade to persistent storage for production)

### Persistent Storage (Optional)

For production, add a persistent disk on Render:
1. Go to service settings
2. Add **Disk** (free 1GB)
3. Mount path: `/opt/render/project/src/data`

This ensures your database survives service restarts!

## Monitoring

View real-time logs on Render:
1. Click your service
2. Click **"Logs"** tab
3. Watch sync requests, uploads, etc.

## Next Steps

Once deployed and tested:
1. Configure frontend to use cloud URL
2. Test client uploads from multiple devices
3. Verify admin can sync offline/online

---

**Need Help?**
- Render Docs: https://render.com/docs
- Check server logs for detailed error messages
