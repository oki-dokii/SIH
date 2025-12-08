"""
Manually trigger a full sync to debug issues.
"""
from sync_manager import SyncManager
import sqlite3

DB_PATH = "data/chat.db"
CLOUD_URL = "https://rag-sync.onrender.com"

print("=" * 60)
print("MANUAL SYNC DEBUG")
print("=" * 60)

# Check cloud
print("\n1. Checking cloud...")
import requests
try:
    r = requests.get(f"{CLOUD_URL}/projects")
    cloud_projects = r.json().get('projects', [])
    print(f"   Cloud has {len(cloud_projects)} projects:")
    for p in cloud_projects:
        print(f"     - ID:{p['id']}, Name:{p['name']}, Created:{p.get('created_ts', 'N/A')[:19]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Check local
print("\n2. Checking offline database...")
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
c.execute("SELECT id, name, remote_id, deleted FROM projects")
local_projects = c.fetchall()
print(f"   Offline has {len(local_projects)} projects:")
for p in local_projects:
    print(f"     - ID:{p[0]}, Name:{p[1]}, RemoteID:{p[2]}, Deleted:{p[3]}")

# Check sync timestamp
c.execute("SELECT value FROM sync_metadata WHERE key='last_projects_sync'")
last_sync = c.fetchone()[0]
print(f"\n   Last sync timestamp: {last_sync}")
conn.close()

# Force sync
print("\n3. Forcing full sync...")
sm = SyncManager(CLOUD_URL, DB_PATH)
if sm.check_connection():
    print("   ✓ Cloud is reachable")
    
    # Sync down
    print("\n   Syncing down projects...")
    count = sm.sync_down_projects()
    print(f"   Result: {count} projects synced")
    
    # Check again
    print("\n4. Rechecking offline database...")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, remote_id, deleted FROM projects WHERE deleted = 0")
    local_projects = c.fetchall()
    print(f"   Offline now has {len(local_projects)} non-deleted projects:")
    for p in local_projects:
        print(f"     - ID:{p[0]}, Name:{p[1]}, RemoteID:{p[2]}")
    conn.close()
else:
    print("   ❌ Cloud is not reachable")

print("\n" + "=" * 60)
print("DEBUG COMPLETE")
print("=" * 60)
