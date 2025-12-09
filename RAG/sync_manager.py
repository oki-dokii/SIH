"""
Simplified Sync Manager for Offline Version

Handles ONE-WAY sync: Cloud → Offline
- Fetches projects from Render cloud
- Downloads DPR PDFs from Render cloud
- Runs automatically in background every 30 seconds
"""

import requests
import threading
import time
from datetime import datetime
from typing import Optional
from pathlib import Path
import sqlite3
import hashlib


class CloudSyncManager:
    def __init__(self, cloud_url: str, db_path: str = "data/chat.db"):
        """
        Initialize simple cloud sync manager.
        
        Args:
            cloud_url: Base URL of Render cloud backend
            db_path: Path to local SQLite database
        """
        self.cloud_url = cloud_url.rstrip('/')
        self.db_path = db_path
        self.is_online = False
        self.sync_interval = 30  # seconds
        self.running = False
        self.sync_thread = None
        self.data_dir = Path("data")
        
        # Initialize sync metadata table
        self._init_sync_metadata()
        
        print(f"🔄 SyncManager initialized with cloud: {self.cloud_url}")
    
    def _init_sync_metadata(self):
        """Create sync_metadata table if it doesn't exist."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sync_metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        
        # Initialize default timestamps
        cursor.execute("""
            INSERT OR IGNORE INTO sync_metadata (key, value)
            VALUES ('last_projects_sync', '2000-01-01T00:00:00')
        """)
        
        cursor.execute("""
            INSERT OR IGNORE INTO sync_metadata (key, value)
            VALUES ('last_dprs_sync', '2000-01-01T00:00:00')
        """)
        
        conn.commit()
        conn.close()
    
    def check_connection(self) -> bool:
        """Check if cloud backend is reachable."""
        try:
            response = requests.get(f"{self.cloud_url}/ping", timeout=5)
            self.is_online = response.status_code == 200
            return self.is_online
        except Exception:
            self.is_online = False
            return False
    
    def get_sync_timestamp(self, key: str) -> str:
        """Get last sync timestamp for a specific sync type."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT value FROM sync_metadata WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        
        return row[0] if row else "2000-01-01T00:00:00"
    
    def set_sync_timestamp(self, key: str, timestamp: str):
        """Update last sync timestamp."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO sync_metadata (key, value)
            VALUES (?, ?)
        """, (key, timestamp))
        
        conn.commit()
        conn.close()
    
    def sync_projects(self) -> int:
        """
        Fetch projects from cloud and create/update locally.
        Returns number of projects synced.
        """
        last_sync = self.get_sync_timestamp('last_projects_sync')
        
        try:
            response = requests.get(
                f"{self.cloud_url}/projects",
                params={"since": last_sync},
                timeout=10
            )
            
            if response.status_code != 200:
                return 0
            
            cloud_projects = response.json().get('projects', [])
            
            if not cloud_projects:
                return 0
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            synced_count = 0
            
            for proj in cloud_projects:
                # Check if already exists by cloud_id
                cursor.execute("SELECT id FROM projects WHERE cloud_id = ?", (proj['id'],))
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing project
                    cursor.execute("""
                        UPDATE projects 
                        SET name = ?, state = ?, scheme = ?, sector = ?,
                            last_sync_ts = datetime('now')
                        WHERE cloud_id = ?
                    """, (proj['name'], proj.get('state'), proj.get('scheme'), 
                          proj.get('sector'), proj['id']))
                    synced_count += 1
                else:
                    # Create new project
                    cursor.execute("""
                        INSERT INTO projects 
                        (name, state, scheme, sector, cloud_id, last_sync_ts, created_ts)
                        VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
                    """, (proj['name'], proj.get('state'), proj.get('scheme'),
                          proj.get('sector'), proj['id'], proj.get('created_ts')))
                    synced_count += 1
            
            conn.commit()
            conn.close()
            
            # Update timestamp
            self.set_sync_timestamp('last_projects_sync', datetime.now().isoformat())
            
            if synced_count > 0:
                print(f"⬇️  Synced {synced_count} projects from cloud")
            
            return synced_count
            
        except Exception as e:
            print(f"❌ Failed to sync projects: {e}")
            return 0
    
    def sync_dprs(self) -> int:
        """
        Fetch DPR metadata and download PDFs.
        Returns number of DPRs downloaded.
        """
        last_sync = self.get_sync_timestamp('last_dprs_sync')
        
        try:
            response = requests.get(
                f"{self.cloud_url}/dprs/all",
                params={"since": last_sync},
                timeout=10
            )
            
            if response.status_code != 200:
                return 0
            
            cloud_dprs = response.json().get('dprs', [])
            
            if not cloud_dprs:
                return 0
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            synced_count = 0
            
            for dpr in cloud_dprs:
                # Check if already downloaded
                cursor.execute("SELECT id, downloaded FROM pdfs WHERE cloud_id = ?", (dpr['id'],))
                existing = cursor.fetchone()
                
                if existing and existing[1] == 1:
                    continue  # Already downloaded
                
                # Find local project by cloud_id
                cursor.execute("SELECT id FROM projects WHERE cloud_id = ?", (dpr['project_id'],))
                local_project = cursor.fetchone()
                
                if not local_project:
                    print(f"⚠️  Skipping DPR {dpr['id']} - project not synced yet")
                    continue
                
                # Download PDF file
                try:
                    print(f"  ⬇️  Downloading {dpr['original_filename']}...")
                    pdf_response = requests.get(
                        f"{self.cloud_url}/dprs/{dpr['id']}/download",
                        stream=True,
                        timeout=60
                    )
                    
                    if pdf_response.status_code != 200:
                        print(f"  ❌ Failed to download DPR {dpr['id']}")
                        continue
                    
                    # Save PDF locally
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"{timestamp}_{dpr['original_filename']}"
                    filepath = self.data_dir / filename
                    
                    with open(filepath, 'wb') as f:
                        for chunk in pdf_response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    # Create or update PDF record
                    if existing:
                        cursor.execute("""
                            UPDATE pdfs
                            SET downloaded = 1, filepath = ?, filename = ?,
                                last_sync_ts = datetime('now')
                            WHERE cloud_id = ?
                        """, (str(filepath), filename, dpr['id']))
                    else:
                        cursor.execute("""
                            INSERT INTO pdfs
                            (filename, original_filename, filepath, project_id,
                             cloud_id, downloaded, last_sync_ts, upload_ts)
                            VALUES (?, ?, ?, ?, ?, 1, datetime('now'), ?)
                        """, (filename, dpr['original_filename'], str(filepath),
                              local_project[0], dpr['id'], dpr.get('upload_ts')))
                    
                    synced_count += 1
                    print(f"  ✓ Downloaded: {dpr['original_filename']}")
                    
                except Exception as e:
                    print(f"  ❌ Error downloading DPR {dpr['id']}: {e}")
            
            conn.commit()
            conn.close()
            
            # Update timestamp
            self.set_sync_timestamp('last_dprs_sync', datetime.now().isoformat())
            
            if synced_count > 0:
                print(f"⬇️  Downloaded {synced_count} PDFs from cloud")
            
            return synced_count
            
        except Exception as e:
            print(f"❌ Failed to sync DPRs: {e}")
            return 0
    
    def full_sync(self):
        """Perform complete sync: projects then DPRs."""
        if not self.check_connection():
            print("⚠️  Cloud backend offline - skipping sync")
            return
        
        print("🔄 Starting full sync...")
        
        # First sync projects (so we have local project records)
        self.sync_projects()
        
        # Then sync DPRs (depends on projects existing)
        self.sync_dprs()
        
        print("✅ Sync complete")
    
    def auto_sync_worker(self):
        """Background worker that runs sync periodically."""
        print(f"🤖 Auto-sync worker started (interval: {self.sync_interval}s)")
        
        while self.running:
            try:
                self.full_sync()
            except Exception as e:
                print(f"❌ Auto-sync error: {e}")
            
            # Wait for next sync interval
            time.sleep(self.sync_interval)
        
        print("🛑 Auto-sync worker stopped")
    
    def start_auto_sync(self):
        """Start the background sync worker."""
        if self.running:
            print("⚠️  Auto-sync already running")
            return
        
        self.running = True
        self.sync_thread = threading.Thread(target=self.auto_sync_worker, daemon=True)
        self.sync_thread.start()
    
    def stop_auto_sync(self):
        """Stop the background sync worker."""
        self.running = False
        if self.sync_thread:
            self.sync_thread.join(timeout=5)
        print("✅ Auto-sync stopped")


# Legacy alias for backward compatibility
SyncManager = CloudSyncManager
