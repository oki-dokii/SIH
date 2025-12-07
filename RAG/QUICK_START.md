# Quick Start Guide - Cloud Sync Setup

## 🎯 What You Have Now

Your project now supports **cloud-based sync**:
- ✅ **Cloud backend** - Stores projects & PDFs centrally
- ✅ **Sync manager** - Auto-syncs every 30 seconds
- ✅ **Admin server** - Works offline, syncs when online
- ✅ **Migration script** - Adds sync columns to database

## 📋 Pre-Flight Checklist

Before starting:
- [ ] Python dependencies installed (`pip install -r requirements.txt`)
- [ ] Ollama running locally
- [ ] Database cleared (you mentioned this is done ✓)
- [ ] GitHub account and repository

---

## 🚀 Setup Steps

### Step 1: Migrate Your Database

Run the migration script to add sync columns:

```bash
cd "c:\Users\Aangir Doshi\OneDrive\Desktop\RAG"
python migrate_db.py
```

Expected output:
```
🔧 Migrating database: data/chat.db
  📋 Updating projects table...
     ✅ Added remote_id column
     ✅ Added dirty column
     ✅ Added last_synced_ts column
  📄 Updating pdfs table...
     ✅ Added remote_id column
     ✅ Added dirty column
     ✅ Added last_synced_ts column
  🔄 Creating sync_metadata table...
     ✅ sync_metadata table ready
✅ Database migration complete!
```

### Step 2: Deploy Cloud Backend to Render

Follow the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) to deploy to Render.

**Quick version:**
1. Push code to GitHub
2. Create Web Service on Render
3. Point to `cloud_backend/` directory
4. Wait for deployment
5. Copy your cloud URL (e.g., `https://pdf-backend-xxxx.onrender.com`)

### Step 3: Configure Admin Server

Create a `.env` file in the root directory:

```bash
# File: RAG/.env
CLOUD_BACKEND_URL=https://your-app-name.onrender.com
```

Replace `your-app-name.onrender.com` with your actual Render URL!

### Step 4: Test Local Backend First (Optional)

Before deploying, test the cloud backend locally:

**Terminal 1 - Cloud Backend:**
```bash
cd cloud_backend
python main.py
```
Runs on http://localhost:8001

**Terminal 2 - Admin Server:**
```bash
# Set local cloud URL for testing
# In .env:
CLOUD_BACKEND_URL=http://localhost:8001

python server.py
```
Runs on http://localhost:8000

**Test sync:**
```bash
# Create a project on admin
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","state":"Maharashtra","scheme":"PMAY","sector":"Housing"}'

# Wait 30 seconds for auto-sync, then check cloud
curl http://localhost:8001/projects
```

### Step 5: Run Admin Server with Cloud Sync

Once cloud backend is deployed:

```bash
# Make sure .env has your Render URL
python server.py
```

You should see:
```
🤖 Initializing RAG Engine...
✓ RAG Engine ready
🔄 SyncManager initialized with cloud: https://your-app.onrender.com
🤖 Auto-sync worker started (interval: 30s)
✅ Sync enabled with cloud: https://your-app.onrender.com
```

---

## ✅ Testing the Complete Flow

### Test 1: Manual Sync Trigger

```bash
curl -X POST http://localhost:8000/api/admin/sync
```

Expected:
```json
{
  "success": true,
  "message": "Sync completed successfully",
  "is_online": true,
  "cloud_url": "https://your-app.onrender.com"
}
```

### Test 2: Check Sync Status

```bash
curl http://localhost:8000/api/admin/sync/status
```

Expected:
```json
{
  "enabled": true,
  "is_online": true,
  "cloud_url": "https://your-app.onrender.com",
  "sync_interval": 30,
  "auto_sync_running": true
}
```

### Test 3: Create Project & Auto-Sync

1. **Create project on admin:**
```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Solar Plant","state":"Gujarat","scheme":"KUSUM","sector":"Energy"}'
```

2. **Wait 30 seconds** for auto-sync

3. **Check cloud backend:**
```bash
curl https://your-app.onrender.com/projects
```

You should see your project!

### Test 4: Client Upload (Simulated)

Upload a PDF directly to cloud (simulating a client):

```bash
curl -X POST https://your-app.onrender.com/projects/1/upload_pdf \
  -F "file=@path/to/test.pdf"
```

Wait 30 seconds, then on admin:
```bash
curl http://localhost:8000/api/projects/1
```

You should see the PDF synced down!

---

## 🔧 Common Issues & Solutions

### "Sync not configured"
- Check `.env` file exists in root directory
- Verify `CLOUD_BACKEND_URL` is set correctly
- Restart `server.py`

### "Cloud backend offline"
- Check Render service status (should be green "Live")
- Free tier may sleep - first request wakes it (30s delay)
- Test: `curl https://your-app.onrender.com/ping`

### Sync not running
Check logs for:
```
ℹ️  Sync disabled (CLOUD_BACKEND_URL not set)
```

This means `.env` not loaded. Try:
```bash
pip install python-dotenv
```

### Projects not syncing
- Check admin console for sync logs:
  - `⬆️ Synced up X projects`
  - `⬇️ Synced down X projects`
- If no logs, check network/firewall

---

## 📱 Next Steps - Frontend Configuration

To point your **frontend** (client) to cloud backend:

### Option A: Development (Local Testing)
Keep frontend pointing to admin server via Vite proxy (current setup)

### Option B: Production (Client Uses Cloud)
Update `frontend/.env.production`:
```
VITE_API_URL=https://your-app.onrender.com
```

Then build frontend:
```bash
cd frontend
npm run build
```

Deploy `frontend/dist/` to Netlify, Vercel, or GitHub Pages.

---

## 📊 Monitoring

**Admin Logs:**
Watch your terminal running `server.py` for:
- `🔄 Starting full sync...`
- `⬆️ Synced up X projects`
- `⬇️ Synced down X files`
- `✅ Sync complete`

**Cloud Logs:**
View on Render dashboard → Your Service → Logs tab

**Sync Status API:**
```bash
# Check from admin
curl http://localhost:8000/api/admin/sync/status
```

---

## 🎉 Success Criteria

You'll know everything works when:
1. ✅ Admin server starts with sync enabled
2. ✅ Manual sync returns success
3. ✅ Projects created on admin appear in cloud (within 30s)
4. ✅ PDFs uploaded to cloud appear on admin (within 30s)
5. ✅ Admin works offline (no errors when cloud is down)

**Happy syncing! 🚀**
