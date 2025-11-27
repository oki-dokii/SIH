"""
Script to add offline fallback to upload_dpr endpoint
This adds try-catch with offline fallback when Gemini upload fails
"""

# Read the file
with open("backend/app.py", "r", encoding="utf-8") as f:
    content = f.read()

#  Check if imports already added
if "from backend.offline_engine import OfflineAnalyzer" not in content:
    # Add imports after existing imports
    content = content.replace(
        "import backend.report_generator as report_generator",
        """import backend.report_generator as report_generator
import backend.db_offline as db_offline  
from backend.offline_engine import OfflineAnalyzer"""
    )
    
    # Add shutil and urllib imports
    content = content.replace(
        "import uuid",
        """import uuid
import shutil
import urllib.request"""
    )
    
    # Add BackgroundTasks import
    content = content.replace(
        "from fastapi import FastAPI, File, Form, UploadFile, HTTPException",
        "from fastapi import FastAPI, File, Form, UploadFile, HTTPException, BackgroundTasks"
    )

# Add offline_analyzer global and helper function
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

# Initialize OfflineAnalyzer in lifespan
if "offline_analyzer = OfflineAnalyzer()" not in content:
    content = content.replace(
        """async def lifespan(app: FastAPI):
    \"\"\"
    Lifespan context manager for startup and shutdown events.
    On startup, check for interrupted DPRs and resume processing in background.
    \"\"\"
    import asyncio""",
        """async def lifespan(app: FastAPI):
    \"\"\"
    Lifespan context manager for startup and shutdown events.
    On startup, check for interrupted DPRs and resume processing in background.
    \"\"\"
    import asyncio
    global offline_analyzer
    
    # Initialize Offline Analyzer
    print("📦 Initializing Offline Analyzer...")
    offline_analyzer = OfflineAnalyzer()"""
    )

# Write the file back
with open("backend/app.py", "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Added offline support imports and initialization")
