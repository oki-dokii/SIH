"""
Database migration for SIH-first online server.
Adds sync columns to existing database.

Run this in your SIH-first project folder.
"""
import sqlite3
from pathlib import Path

# UPDATE THIS PATH to match your database location!
DB_PATH = "data/database.db"  # or whatever your db file is called

def add_sync_columns_online():
    """Add sync columns to online server database."""
    
    if not Path(DB_PATH).exists():
        print(f"❌ Database not found: {DB_PATH}")
        print("Please update DB_PATH in this script to point to your database file.")
        return False
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("=" * 60)
    print("ADDING SYNC COLUMNS TO ONLINE SERVER DATABASE")
    print(f"Database: {DB_PATH}")
    print("=" * 60)
    
    # Add to projects table
    print("\n📋 Projects table:")
    for col_name, col_type in [
        ('remote_id', 'INTEGER'),
        ('dirty', 'INTEGER DEFAULT 1'),
        ('last_synced_ts', 'TEXT'),
        ('deleted', 'INTEGER DEFAULT 0'),
        ('deleted_at', 'TEXT')
    ]:
        try:
            cursor.execute(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}")
            print(f"  ✓ Added {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"  ⚠ {col_name} already exists")
            else:
                print(f"  ❌ Error: {e}")
    
    # Add to dprs table (or pdfs table - check your table name!)
    print("\n📄 DPRs table:")
    
    # Check which table name exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name='dprs' OR name='pdfs')")
    table_result = cursor.fetchone()
    
    if not table_result:
        print("  ❌ No dprs or pdfs table found!")
        print("  Please check your database structure.")
        conn.close()
        return False
    
    table_name = table_result[0]
    print(f"  Using table: {table_name}")
    
    for col_name, col_type in [
        ('remote_id', 'INTEGER'),
        ('dirty', 'INTEGER DEFAULT 1'),
        ('last_synced_ts', 'TEXT'),
        ('deleted', 'INTEGER DEFAULT 0'),
        ('deleted_at', 'TEXT')
    ]:
        try:
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
            print(f"  ✓ Added {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"  ⚠ {col_name} already exists")
            else:
                print(f"  ❌ Error: {e}")
    
    # Create sync_metadata table
    print("\n🔄 Sync metadata:")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    
    cursor.execute("""
        INSERT OR IGNORE INTO sync_metadata (key, value)
        VALUES ('last_projects_sync', '2000-01-01T00:00:00')
    """)
    
    cursor.execute("""
        INSERT OR IGNORE INTO sync_metadata (key, value)
        VALUES ('last_files_sync', '2000-01-01T00:00:00')
    """)
    
    print("  ✓ sync_metadata table ready")
    
    conn.commit()
    
    # Verify
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)
    
    cursor.execute("PRAGMA table_info(projects)")
    project_cols = [col[1] for col in cursor.fetchall()]
    has_sync = 'remote_id' in project_cols and 'dirty' in project_cols and 'deleted' in project_cols
    
    print(f"Projects table: {len(project_cols)} columns")
    print(f"  Sync columns present: {'✅ YES' if has_sync else '❌ NO'}")
    
    cursor.execute(f"PRAGMA table_info({table_name})")
    file_cols = [col[1] for col in cursor.fetchall()]
    has_sync_files = 'remote_id' in file_cols and 'dirty' in file_cols and 'deleted' in file_cols
    
    print(f"{table_name.upper()} table: {len(file_cols)} columns")
    print(f"  Sync columns present: {'✅ YES' if has_sync_files else '❌ NO'}")
    
    conn.close()
    
    if has_sync and has_sync_files:
        print("\n✅ Migration successful!")
        print("\nNext steps:")
        print("1. Add CLOUD_BACKEND_URL=https://rag-sync.onrender.com to .env")
        print("2. Copy sync_manager.py from RAG folder")
        print("3. Initialize SyncManager in your server code")
        print("4. Restart server")
        return True
    else:
        print("\n⚠️ Some columns may be missing. Check errors above.")
        return False

if __name__ == "__main__":
    print("IMPORTANT: Update DB_PATH at the top of this file before running!")
    print("")
    response = input("Press Enter to continue or Ctrl+C to cancel...")
    add_sync_columns_online()
