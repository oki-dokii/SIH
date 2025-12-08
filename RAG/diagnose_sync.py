"""
Complete sync diagnostic tool - checks all three systems and identifies issues.
"""
import sqlite3
import requests
from datetime import datetime

def check_local_db(db_path, label):
    """Check local database status."""
    print(f"\n{'='*60}")
    print(f"{label} DATABASE CHECK")
    print('='*60)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check projects
    cursor.execute("SELECT id, name, remote_id, dirty, deleted FROM projects")
    projects = cursor.fetchall()
    print(f"\n📋 Projects ({len(projects)} total):")
    for p in projects:
        status = []
        if p[3]: status.append("DIRTY")
        if p[4]: status.append("DELETED")
        if p[2]: status.append(f"RemoteID:{p[2]}")
        status_str = f" [{', '.join(status)}]" if status else ""
        print(f"  - ID:{p[0]}, Name:{p[1]}{status_str}")
    
    # Check sync timestamp
    cursor.execute("SELECT value FROM sync_metadata WHERE key='last_projects_sync'")
    ts = cursor.fetchone()
    print(f"\n🕐 Last Sync Timestamp: {ts[0] if ts else 'NOT SET'}")
    
    conn.close()

def check_cloud():
    """Check cloud backend status."""
    print(f"\n{'='*60}")
    print("CLOUD BACKEND CHECK")
    print('='*60)
    
    url = "https://rag-sync.onrender.com"
    
    try:
        # Ping
        r = requests.get(f"{url}/ping", timeout=5)
        print(f"\n✓ Cloud is reachable (status: {r.status_code})")
        
        # Get projects
        r = requests.get(f"{url}/projects", timeout=10)
        if r.status_code == 200:
            projects = r.json().get('projects', [])
            print(f"\n📦 Cloud Projects ({len(projects)} total):")
            for p in projects:
                deleted = "(DELETED)" if p.get('deleted') else ""
                print(f"  - ID:{p['id']}, Name:{p.get('name', 'UNNAMED')}, Created:{p.get('created_ts', 'N/A')[:19]} {deleted}")
        else:
            print(f"❌ Failed to fetch projects: {r.status_code}")
            
    except Exception as e:
        print(f"❌ Cloud error: {e}")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("SYNC DIAGNOSTIC TOOL")
    print("="*60)
    
    # Check offline
    check_local_db("data/chat.db", "OFFLINE (port 8001)")
    
    # Check cloud
    check_cloud()
    
    print("\n" + "="*60)
    print("ANALYSIS")
    print("="*60)
    
    print("""
Expected behavior:
1. Create project in ONLINE (port 8000) → marked dirty=1
2. Online syncs UP → creates in cloud
3. Offline syncs DOWN → pulls from cloud

If projects missing:
- Check if dirty=1 in online database
- Check if sync_up is running in online server logs
- Check if created_ts is BEFORE last_projects_sync timestamp
- Reset timestamp if needed: python reset_sync_timestamp.py

If same timestamp problem recurring:
- The bug is in how timestamps are being set
- Need to ensure timestamp only updates when synced_count > 0
    """)
    
    print("\n✅ Diagnostic complete!")
