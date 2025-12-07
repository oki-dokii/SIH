"""
Sync Manager for Admin App

Handles bidirectional sync between admin's local database and cloud backend.
Runs automatically in background when internet is available.

Sync Strategy:
- Sync Up: Push dirty (modified) local projects/files to cloud
- Sync Down: Pull new/updated projects/files from cloud
- Frequency: Every 30 seconds when online
"""

import requests
import threading
import time
from datetime import datetime
from typing import Optional, Dict, List
import sqlite3


class SyncManager:
    def __init__(self, cloud_url: str, db_path: str = "data/chat.db"):
        """
        Initialize sync manager.
        
        Args:
            cloud_url: Base URL of cloud backend (e.g., https://your-app.onrender.com)
            db_path: Path to local SQLite database
        """
        self.cloud_url = cloud_url.rstrip('/')
        self.db_path = db_path
        self.is_online = False
        self.sync_interval = 30  # seconds
        self.running = False
        self.sync_thread = None
        
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
        
        # Initialize default timestamps if not present
        cursor.execute("""
            INSERT OR IGNORE INTO sync_metadata (key, value)
            VALUES ('last_projects_sync', '2000-01-01T00:00:00')
        """)
        
        cursor.execute("""
            INSERT OR IGNORE INTO sync_metadata (key, value)
            VALUES ('last_files_sync', '2000-01-01T00:00:00')
        """)
        
        conn.commit()
        conn.close()
    
    def check_connection(self) -> bool:
        """
        Check if cloud backend is reachable.
        
        Returns:
            True if cloud is online, False otherwise
        """
        try:
            response = requests.get(f"{self.cloud_url}/ping", timeout=5)
            self.is_online = response.status_code == 200
            return self.is_online
        except Exception as e:
            self.is_online = False
            return False
    
    def get_sync_timestamp(self, key: str) -> str:
        """Get last sync timestamp for a specific sync type."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT value FROM sync_metadata WHERE key = ?
        """, (key,))
        
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
    
    def sync_up_projects(self) -> int:
        """
        Push dirty projects to cloud backend.
        
        Returns:
            Number of projects synced
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all dirty projects
        cursor.execute("""
            SELECT * FROM projects WHERE dirty = 1
        """)
        
        dirty_projects = [dict(row) for row in cursor.fetchall()]
        synced_count = 0
        
        for project in dirty_projects:
            try:
                if project['remote_id']:
                    # Update existing cloud project
                    response = requests.put(
                        f"{self.cloud_url}/projects/{project['remote_id']}",
                        json={
                            "name": project['name'],
                            "state": project['state'],
                            "scheme": project['scheme'],
                            "sector": project['sector']
                        },
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        # Mark as synced
                        cursor.execute("""
                            UPDATE projects 
                            SET dirty = 0, last_synced_ts = datetime('now')
                            WHERE id = ?
                        """, (project['id'],))
                        synced_count += 1
                
                else:
                    # Create new cloud project
                    response = requests.post(
                        f"{self.cloud_url}/projects",
                        json={
                            "name": project['name'],
                            "state": project['state'],
                            "scheme": project['scheme'],
                            "sector": project['sector']
                        },
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        cloud_project = response.json()
                        
                        # Update local project with remote_id
                        cursor.execute("""
                            UPDATE projects 
                            SET remote_id = ?, dirty = 0, last_synced_ts = datetime('now')
                            WHERE id = ?
                        """, (cloud_project['id'], project['id']))
                        synced_count += 1
                
            except Exception as e:
                print(f"❌ Failed to sync project {project['id']}: {e}")
        
        conn.commit()
        conn.close()
        
        if synced_count > 0:
            print(f"⬆️ Synced up {synced_count} projects")
        
        return synced_count
    
    def sync_down_projects(self) -> int:
        """
        Pull new/updated projects from cloud.
        
        Returns:
            Number of projects synced
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
            
            for cloud_project in cloud_projects:
                # Check if we already have this project
                cursor.execute("""
                    SELECT id FROM projects WHERE remote_id = ?
                """, (cloud_project['id'],))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing local project (only if not dirty)
                    cursor.execute("""
                        UPDATE projects 
                        SET name = ?, state = ?, scheme = ?, sector = ?,
                            last_synced_ts = datetime('now')
                        WHERE remote_id = ? AND dirty = 0
                    """, (
                        cloud_project['name'],
                        cloud_project['state'],
                        cloud_project['scheme'],
                        cloud_project['sector'],
                        cloud_project['id']
                    ))
                    
                    if cursor.rowcount > 0:
                        synced_count += 1
                else:
                    # Create new local project from cloud
                    cursor.execute("""
                        INSERT INTO projects 
                        (name, state, scheme, sector, remote_id, dirty, last_synced_ts, created_ts)
                        VALUES (?, ?, ?, ?, ?, 0, datetime('now'), ?)
                    """, (
                        cloud_project['name'],
                        cloud_project['state'],
                        cloud_project['scheme'],
                        cloud_project['sector'],
                        cloud_project['id'],
                        cloud_project['created_ts']
                    ))
                    synced_count += 1
            
            conn.commit()
            conn.close()
            
            # Update last sync timestamp
            current_time = datetime.now().isoformat()
            self.set_sync_timestamp('last_projects_sync', current_time)
            
            if synced_count > 0:
                print(f"⬇️ Synced down {synced_count} projects")
            
            return synced_count
            
        except Exception as e:
            print(f"❌ Failed to sync down projects: {e}")
            return 0
    
    def sync_down_files(self) -> int:
        """
        Pull new files uploaded by clients from cloud.
        Downloads file metadata only (not the actual PDF files).
        
        Returns:
            Number of files synced
        """
        last_sync = self.get_sync_timestamp('last_files_sync')
        
        try:
            response = requests.get(
                f"{self.cloud_url}/files",
                params={"since": last_sync},
                timeout=10
            )
            
            if response.status_code != 200:
                return 0
            
            cloud_files = response.json().get('files', [])
            
            if not cloud_files:
                return 0
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            synced_count = 0
            
            for cloud_file in cloud_files:
                # Check if we already have this file
                cursor.execute("""
                    SELECT id FROM pdfs WHERE remote_id = ?
                """, (cloud_file['id'],))
                
                existing = cursor.fetchone()
                
                if not existing:
                    # Find local project by remote_id
                    cursor.execute("""
                        SELECT id FROM projects WHERE remote_id = ?
                    """, (cloud_file['project_id'],))
                    
                    local_project = cursor.fetchone()
                    
                    if local_project:
                        # Create new local file record
                        # Note: filepath points to cloud, not downloaded locally yet
                        cursor.execute("""
                            INSERT INTO pdfs 
                            (filename, original_filename, filepath, project_id, 
                             remote_id, dirty, upload_ts, status)
                            VALUES (?, ?, ?, ?, ?, 0, ?, 'cloud_only')
                        """, (
                            cloud_file['filename'],
                            cloud_file['original_filename'],
                            cloud_file['filepath'],
                            local_project[0],
                            cloud_file['id'],
                            cloud_file['upload_ts']
                        ))
                        synced_count += 1
            
            conn.commit()
            conn.close()
            
            # Update last sync timestamp
            current_time = datetime.now().isoformat()
            self.set_sync_timestamp('last_files_sync', current_time)
            
            if synced_count > 0:
                print(f"⬇️ Synced down {synced_count} files")
            
            return synced_count
            
        except Exception as e:
            print(f"❌ Failed to sync down files: {e}")
            return 0
    
    def full_sync(self):
        """
        Perform a complete bidirectional sync.
        Order: sync up first (push changes), then sync down (pull updates).
        """
        if not self.check_connection():
            print("⚠️ Cloud backend offline - skipping sync")
            return
        
        print("🔄 Starting full sync...")
        
        # Sync up (push local changes)
        self.sync_up_projects()
        
        # Sync down (pull cloud updates)
        self.sync_down_projects()
        self.sync_down_files()
        
        print("✅ Sync complete")
    
    def auto_sync_worker(self):
        """
        Background worker that runs sync periodically.
        Runs every 30 seconds when enabled.
        """
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
            print("⚠️ Auto-sync already running")
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
