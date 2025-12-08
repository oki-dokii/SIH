"""
Complete database cleanup - clears projects and dprs from all three systems:
1. Offline server (localhost:8001)
2. Online server (localhost:8000) - you'll need to run this separately
3. Cloud backend (Render)
"""
import sqlite3
import requests
from pathlib import Path

def clear_local_database(db_path, table_names, label):
    """Clear specified tables from a local database."""
    if not Path(db_path).exists():
        print(f"⚠️  {label} database not found: {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"\n📁 Clearing {label}: {db_path}")
    
    for table in table_names:
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
        if cursor.fetchone():
            cursor.execute(f"DELETE FROM {table}")
            count = cursor.rowcount
            print(f"  ✓ Deleted {count} rows from {table}")
        else:
            print(f"  ⚠️  Table {table} not found")
    
    # Reset sync timestamps
    cursor.execute("""
        UPDATE sync_metadata 
        SET value = '2000-01-01T00:00:00' 
        WHERE key IN ('last_projects_sync', 'last_files_sync')
    """)
    print(f"  ✓ Reset sync timestamps")
    
    conn.commit()
    conn.close()
    return True

def clear_cloud_database(cloud_url):
    """Clear cloud database by calling delete endpoints."""
    print(f"\n☁️  Clearing cloud backend: {cloud_url}")
    
    try:
        # Get all projects
        response = requests.get(f"{cloud_url}/projects", timeout=10)
        if response.status_code != 200:
            print(f"  ❌ Failed to fetch projects: {response.status_code}")
            return False
        
        projects = response.json().get('projects', [])
        print(f"  Found {len(projects)} projects to delete")
        
        # Delete each project (soft delete)
        for project in projects:
            try:
                r = requests.post(f"{cloud_url}/projects/{project['id']}/delete", timeout=10)
                if r.status_code == 200:
                    print(f"  ✓ Deleted project: {project['name']} (ID:{project['id']})")
                else:
                    print(f"  ⚠️  Failed to delete project {project['id']}: {r.status_code}")
            except Exception as e:
                print(f"  ❌ Error deleting project {project['id']}: {e}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Failed to clear cloud: {e}")
        return False

if __name__ == "__main__":
    print("=" * 70)
    print("COMPLETE DATABASE CLEANUP")
    print("=" * 70)
    print("\n⚠️  WARNING: This will delete ALL projects and dprs from:")
    print("  1. Offline server (RAG)")
    print("  2. Cloud backend (Render)")
    print("\nPress Ctrl+C to cancel or Enter to continue...")
    input()
    
    # 1. Clear offline database
    clear_local_database(
        "data/chat.db", 
        ["projects", "pdfs", "chunks", "messages"],
        "Offline Server"
    )
    
    # 2. Clear cloud backend
    CLOUD_URL = "https://rag-sync.onrender.com"
    clear_cloud_database(CLOUD_URL)
    
    print("\n" + "=" * 70)
    print("✅ CLEANUP COMPLETE!")
    print("=" * 70)
    
    print("\n📋 To clear ONLINE server database:")
    print("   1. Open a new terminal in SIH-first folder")
    print("   2. Create this script there (save as clear_online_db.py):")
    print()
    print("=" * 70)
    print('''
import sqlite3

# UPDATE THIS PATH to your online server database!
DB_PATH = "data/database.db"  # or whatever your db file is called

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("Clearing online database...")
cursor.execute("DELETE FROM projects")
print(f"  ✓ Deleted {cursor.rowcount} projects")

cursor.execute("DELETE FROM dprs")  # or "pdfs" if that's your table name
print(f"  ✓ Deleted {cursor.rowcount} dprs")

cursor.execute("UPDATE sync_metadata SET value = '2000-01-01T00:00:00'")
print(f"  ✓ Reset sync timestamps")

conn.commit()
conn.close()
print("✅ Online database cleared!")
''')
    print("=" * 70)
    
    print("\n🔄 Next steps:")
    print("  1. Clear online database using script above")
    print("  2. Restart both servers")
    print("  3. Start fresh with sync testing!")
