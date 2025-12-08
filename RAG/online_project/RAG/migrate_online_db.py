"""
Database migration script for online server.
Adds sync-related columns to existing database.
"""
import sqlite3
from pathlib import Path

DB_PATH = "data/dprs.db"  # Online server uses dprs.db

def migrate_online_db():
    """Add sync columns to online server database."""
    
    if not Path(DB_PATH).exists():
        print(f"❌ Database not found: {DB_PATH}")
        print("Creating new database...")
        Path("data").mkdir(exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("=" * 60)
    print("MIGRATING ONLINE SERVER DATABASE")
    print("=" * 60)
    
    # Check if projects table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='projects'
    """)
    
    if not cursor.fetchone():
        print("\n Creating projects table...")
        cursor.execute("""
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                state TEXT,
                scheme TEXT,
                sector TEXT,
                created_ts TEXT DEFAULT (datetime('now'))
            )
        """)
        print("✓ Created projects table")
    
    # Check if dprs table exists  
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='dprs'
    """)
    
    if not cursor.fetchone():
        print("\nCreating dprs table...")
        cursor.execute("""
            CREATE TABLE dprs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                filename TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                filepath TEXT,
                uploaded_file_ref TEXT,
                upload_ts TEXT DEFAULT (datetime('now')),
                summary_json TEXT,
                client_id TEXT,
                status TEXT DEFAULT 'uploaded',
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        """)
        print("✓ Created dprs table")
    
    # Add sync columns to projects
    print("\n📋 Adding sync columns to projects table...")
    
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
                print(f"  ❌ Error adding {col_name}: {e}")
    
    # Add sync columns to dprs
    print("\n📄 Adding sync columns to dprs table...")
    
    for col_name, col_type in [
        ('remote_id', 'INTEGER'),
        ('dirty', 'INTEGER DEFAULT 1'),
        ('last_synced_ts', 'TEXT'),
        ('deleted', 'INTEGER DEFAULT 0'),
        ('deleted_at', 'TEXT')
    ]:
        try:
            cursor.execute(f"ALTER TABLE dprs ADD COLUMN {col_name} {col_type}")
            print(f"  ✓ Added {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"  ⚠ {col_name} already exists")
            else:
                print(f"  ❌ Error adding {col_name}: {e}")
    
    # Create sync_metadata table
    print("\n🔄 Creating sync_metadata table...")
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
    print(f"✅ Projects columns ({len(project_cols)}): {', '.join(project_cols)}")
    
    cursor.execute("PRAGMA table_info(dprs)")
    dpr_cols = [col[1] for col in cursor.fetchall()]
    print(f"✅ DPRs columns ({len(dpr_cols)}): {', '.join(dpr_cols)}")
    
    conn.close()
    
    print("\n✅ Online database migration complete!")
    print("\nNext steps:")
    print("1. Add CLOUD_BACKEND_URL to .env")
    print("2. Initialize SyncManager in app.py")
    print("3. Start server and verify sync")

if __name__ == "__main__":
    migrate_online_db()
