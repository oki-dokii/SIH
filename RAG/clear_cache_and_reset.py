"""
PERMANENT FIX: Ensure server restarts with fresh sync_manager code.
This removes Python's cached .pyc files that might have old code.
"""
import os
import shutil
from pathlib import Path

# Remove __pycache__ directories
for pycache in Path(".").rglob("__pycache__"):
    if pycache.is_dir():
        shutil.rmtree(pycache)
        print(f"✓ Removed {pycache}")

# Remove .pyc files
for pyc in Path(".").rglob("*.pyc"):
    pyc.unlink()
    print(f"✓ Removed {pyc}")

# Reset timestamp
import sqlite3
conn = sqlite3.connect("data/chat.db")
cursor = conn.cursor()
cursor.execute("UPDATE sync_metadata SET value = '2000-01-01T00:00:00' WHERE key IN ('last_projects_sync', 'last_files_sync')")
conn.commit()
conn.close()

print("\n✅ Cache cleared and timestamp reset!")
print("\n🔄 Now restart the server:")
print("   1. Stop server (Ctrl+C)")
print("   2. python server.py")
print("\nThe server will use the fixed sync_manager code.")
