# How to Run DPR Analyzer

This guide provides detailed, step-by-step instructions to get the DPR Analyzer up and running on your local machine.

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Initial Setup](#2-initial-setup)
3. [Environment Configuration](#3-environment-configuration)
4. [Installing Dependencies](#4-installing-dependencies)
5. [Database Initialization](#5-database-initialization)
6. [Running the Application](#6-running-the-application)
7. [First-Time Login](#7-first-time-login)
8. [Testing the System](#8-testing-the-system)
9. [Common Workflows](#9-common-workflows)
10. [Stopping the Application](#10-stopping-the-application)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

### Check Your System

**Python Version:**
```bash
python --version
# or
python3 --version
```
✅ Required: Python 3.9 or higher

**Node.js & npm:**
```bash
node --version
npm --version
```
✅ Required: Node.js 16.0+ and npm 7.0+

**Git (Optional):**
```bash
git --version
```
✅ Recommended for cloning the repository

### Get Gemini API Key

1. Visit https://ai.google.dev/
2. Click "Get API Key"
3. Sign in with Google account
4. Create a new API key
5. Copy and save the key (you'll need it later)

**Important:** Keep your API key secure and never commit it to version control.

---

## 2. Initial Setup

### Option A: Clone from GitHub (Recommended)

```bash
# Clone the repository
git clone https://github.com/aangir14/SIH-first.git

# Navigate to project directory
cd SIH-first
```

### Option B: Download ZIP

1. Go to https://github.com/aangir14/SIH-first
2. Click "Code" → "Download ZIP"
3. Extract the ZIP file
4. Open terminal in the extracted folder

### Verify Directory Structure

```bash
# Check if you're in the correct directory
ls -la
```

You should see:
```
backend/
frontend/
data/
.env.example (or you'll create this)
requirements.txt
README.md
```

---

## 3. Environment Configuration

### Create .env File

```bash
# Create .env file
touch .env

# Open in your preferred editor
nano .env
# or
vim .env
# or
code .env  # VS Code
```

### Add Required Configuration

Copy and paste the following into your `.env` file:

```env
# ==========================================
# DPR Analyzer Configuration
# ==========================================

# REQUIRED: Gemini API Key
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Server Configuration
HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_PORT=5000

# Database
DATABASE_PATH=data/dpr.db

# Default Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Optional: Debug Mode
DEBUG=True
```

**IMPORTANT:** Replace `YOUR_GEMINI_API_KEY_HERE` with your actual Gemini API key from step 1.

### Save and Close

- **nano**: Press `Ctrl+X`, then `Y`, then `Enter`
- **vim**: Press `Esc`, type `:wq`, press `Enter`
- **VS Code**: Press `Ctrl+S` (or `Cmd+S` on Mac)

---

## 4. Installing Dependencies

### Backend Dependencies

```bash
# Optional but recommended: Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate

# On Windows:
venv\Scripts\activate

# You should see (venv) in your terminal prompt

# Install Python packages
pip install -r requirements.txt

# Verify installation
pip list
```

**Expected packages:** fastapi, uvicorn, google-generativeai, jinja2, plotly, weasyprint, passlib, python-dotenv, etc.

### Frontend Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install Node packages
npm install

# This may take 2-5 minutes
# You should see progress bar and no errors

# Verify installation
npm list --depth=0

# Return to root directory
cd ..
```

---

## 5. Database Initialization

### Automatic Initialization

The database will be created automatically on first run, but you can initialize it manually:

```bash
# Initialize database
python -c "import backend.db as db; db.init_db()"
```

Expected output:
```
✓ Database initialized at data/dpr.db
```

### Verify Database

```bash
# Check if database file exists
ls -lh data/dpr.db

# View database schema (optional)
sqlite3 data/dpr.db ".schema"
```

You should see tables: `dprs`, `projects`, `clients`, `chat_messages`, `comparison_chats`, etc.

---

## 6. Running the Application

### Method 1: Using Separate Terminal Windows (Recommended)

**Terminal 1 - Backend:**
```bash
# Make sure you're in the project root directory
# Activate virtual environment if you created one
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Start backend server
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Terminal 2 - Frontend:**
```bash
# Navigate to frontend directory
cd frontend

# Start frontend development server
npm run dev -- --host 127.0.0.1 --port 5000
```

Expected output:
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://127.0.0.1:5000/
  ➜  Network: use --host to expose
```

### Method 2: Using tmux/screen (Advanced)

```bash
# Install tmux (if not already installed)
# Ubuntu/Debian: sudo apt install tmux
# Mac: brew install tmux

# Start tmux session
tmux new -s dpr-analyzer

# Split window horizontally
Ctrl+b %

# In left pane - start backend
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload

# Switch to right pane
Ctrl+b →

# In right pane - start frontend
cd frontend
npm run dev -- --host 127.0.0.1 --port 5000

# Detach from tmux (keeps running in background)
Ctrl+b d

# Reattach later
tmux attach -t dpr-analyzer
```

### Method 3: Using Shell Script

Create a `run.sh` file:

```bash
#!/bin/bash

# Kill any existing processes on ports 8000 and 5000
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5000 | xargs kill -9 2>/dev/null

# Start backend in background
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload &

# Wait for backend to start
sleep 3

# Start frontend in background
cd frontend && npm run dev -- --host 127.0.0.1 --port 5000 &

echo "✓ Backend running on http://127.0.0.1:8000"
echo "✓ Frontend running on http://127.0.0.1:5000"
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
wait
```

Make executable and run:
```bash
chmod +x run.sh
./run.sh
```

---

## 7. First-Time Login

### Access the Application

Open your web browser and navigate to:
```
http://127.0.0.1:5000
```

### Admin Login

1. Click on **"Admin Login"** or navigate to `/admin/login`
2. Enter credentials:
   - **Username:** `admin`
   - **Password:** `admin123` (or what you set in `.env`)
3. Click **"Login"**

You should be redirected to the admin dashboard.

### Create a Test Client Account

1. In the admin panel, go to **"Clients"** or **"User Management"**
2. Click **"Add New Client"**
3. Fill in:
   - **Email:** test@example.com
   - **Password:** test123
   - **Name:** Test User
4. Click **"Create"**

### Client Login

1. Logout from admin
2. Go to **"User Login"** or `/user/login`
3. Enter:
   - **Email:** test@example.com
   - **Password:** test123
4. Click **"Login"**

---

## 8. Testing the System

### Test 1: Create a Project (Admin)

1. Login as admin
2. Go to **"Projects"**
3. Click **"New Project"**
4. Fill in:
   - **Name:** Test Highway Project
   - **State:** Assam
   - **Sector:** Roads and Bridges
5. Click **"Create"**

### Test 2: Upload a DPR (Client)

1. Login as client (test@example.com)
2. Go to **"Upload DPR"**
3. Select project: "Test Highway Project"
4. Choose a PDF file (any PDF for testing)
5. Click **"Upload"**
6. Wait for analysis (~30-60 seconds)

### Test 3: View Analysis (Admin)

1. Login as admin
2. Go to **"Projects"** → Select project
3. Click on the uploaded DPR
4. Verify you see:
   - Overall Score
   - Financial Analysis
   - Compliance Scoring (should show 12 categories for Roads and Bridges)
   - Risk Assessment
   - Recommendations

### Test 4: Chat with DPR (Client/Admin)

1. Open a DPR
2. Click **"Chat"** or **"Ask Questions"**
3. Type: "What is the total project cost?"
4. Press Enter
5. Wait for AI response

---

## 9. Common Workflows

### Workflow 1: Full DPR Analysis Pipeline

```
Admin creates project
  ↓
Client uploads DPR PDF
  ↓
System analyzes with Gemini (auto)
  ↓
Admin reviews analysis
  ↓
Admin provides feedback
  ↓
Client views feedback
```

### Workflow 2: Comparing Multiple DPRs

```
Client uploads DPR 1
Client uploads DPR 2 (same project)
  ↓
Admin goes to project
  ↓
Admin clicks "Compare All DPRs"
  ↓
System generates comparison
  ↓
Admin views recommendation
```

### Workflow 3: Re-analyzing a DPR

```
Admin opens DPR
  ↓
Admin clicks "Analyze" button
  ↓
System re-runs analysis with latest schema
  ↓
Updated results appear
```

---

## 10. Stopping the Application

### Method 1: Separate Terminals

In each terminal window:
```bash
# Press Ctrl+C
# Wait for shutdown message
```

### Method 2: Kill Processes

```bash
# Find processes
lsof -i :8000
lsof -i :5000

# Kill backend
kill -9 <PID_of_8000>

# Kill frontend
kill -9 <PID_of_5000>
```

### Method 3: Using Script

```bash
# Create stop.sh
#!/bin/bash
lsof -ti:8000 | xargs kill -9
lsof -ti:5000 | xargs kill -9
echo "✓ All services stopped"
```

---

## 11. Troubleshooting

### Issue: "Port already in use"

**Problem:** Port 8000 or 5000 is occupied

**Solution:**
```bash
# Check what's using the port
lsof -i :8000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use different ports
python -m uvicorn backend.app:app --port 8001
npm run dev -- --port 5001
```

### Issue: "No module named 'backend'"

**Problem:** Python can't find backend module

**Solution:**
```bash
# Make sure you're in project root
pwd

# Verify backend directory exists
ls backend/

# Try running with python -m
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

### Issue: "GEMINI_API_KEY not found"

**Problem:** Environment variable not set

**Solution:**
```bash
# Verify .env file exists
cat .env

# Check if GEMINI_API_KEY is set
grep GEMINI_API_KEY .env

# If missing, edit .env and add:
GEMINI_API_KEY=your_actual_key_here
```

### Issue: "429 Quota Exceeded"

**Problem:** Gemini API free tier limit reached

**Solution:**
- Wait 24 hours for quota reset
- Check usage: https://ai.dev/usage?tab=rate-limit
- Consider upgrading to paid tier
- Use existing analyzed DPRs for testing

### Issue: Database locked

**Problem:** SQLite database is locked

**Solution:**
```bash
# Stop all servers
# Delete database and reinitialize
rm data/dpr.db
python -c "import backend.db as db; db.init_db()"
```

### Issue: Frontend won't start

**Problem:** npm dependencies issue

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
cd ..
```

### Issue: "WeasyPrint cannot find Cairo"

**Problem:** System dependencies missing

**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get install python3-dev python3-pip python3-cffi libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info

# macOS
brew install python3 cairo pango gdk-pixbuf libffi

# Then reinstall
pip install weasyprint
```

---

## 🎉 Success Checklist

- [ ] Python 3.9+ installed and verified
- [ ] Node.js 16+ and npm installed
- [ ] Gemini API key obtained
- [ ] Repository cloned/downloaded
- [ ] Virtual environment created (optional)
- [ ] Dependencies installed (backend + frontend)
- [ ] .env file created and configured
- [ ] Database initialized
- [ ] Backend running on port 8000
- [ ] Frontend running on port 5000
- [ ] Can access http://127.0.0.1:5000
- [ ] Admin login successful
- [ ] Test project created
- [ ] Test DPR uploaded and analyzed

---

## 🚀 Next Steps

Once everything is running:

1. **Explore the Features:**
   - Upload various types of DPRs
   - Test different sectors (Roads and Bridges vs others)
   - Compare multiple DPRs
   - Use the chat feature

2. **Customize:**
   - Modify compliance weights (if needed)
   - Update admin credentials
   - Add more sectors/states to enums

3. **Deploy:**
   - See README.md for deployment options
   - Consider Docker for production

4. **Monitor:**
   - Check terminal logs for errors
   - Monitor API quota usage
   - Review database size

---

## 📞 Need Help?

- **GitHub Issues:** https://github.com/aangir14/SIH-first/issues
- **Check Logs:** Look at terminal output for specific errors
- **API Documentation:** http://127.0.0.1:8000/docs (when backend is running)

---

**Happy Analyzing! 🎯**
