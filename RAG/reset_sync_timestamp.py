"""
Quick fix to reset sync timestamp.
Run this when sync timestamp gets stuck in the future.
"""
import sqlite3

DB_PATH = "data/chat.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check current value
cursor.execute("SELECT value FROM sync_metadata WHERE key='last_projects_sync'")
current = cursor.fetchone()
print(f"Current sync timestamp: {current[0] if current else 'NOT SET'}")

# Reset to beginning of time
cursor.execute("""
    UPDATE sync_metadata 
    SET value = '2000-01-01T00:00:00' 
    WHERE key = 'last_projects_sync'
""")

cursor.execute("""
    UPDATE sync_metadata 
    SET value = '2000-01-01T00:00:00' 
    WHERE key = 'last_files_sync'
""")

conn.commit()

# Verify
cursor.execute("SELECT value FROM sync_metadata WHERE key='last_projects_sync'")
new = cursor.fetchone()
print(f"New sync timestamp: {new[0]}")

conn.close()

print("\n✅ Sync timestamp reset! Restart server to pull all projects from cloud.")
