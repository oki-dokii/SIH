"""
Database Migration Script

Adds sync columns to existing database schema:
- projects table: remote_id, dirty, last_synced_ts
- pdfs table: remote_id, dirty, last_synced_ts  
- Creates sync_metadata table

Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS pattern).
"""

import sqlite3
from pathlib import Path


def migrate_database(db_path: str = "data/chat.db"):
    """
    Add sync columns to existing database.
    
    Args:
        db_path: Path to SQLite database file
    """
    if not Path(db_path).exists():
        print(f"❌ Database not found: {db_path}")
        print("   Run server.py first to create the database")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"🔧 Migrating database: {db_path}")
    
    # Add sync columns to projects table
    print("  📋 Updating projects table...")
    try:
        cursor.execute("ALTER TABLE projects ADD COLUMN remote_id INTEGER")
        print("     ✅ Added remote_id column")
    except sqlite3.OperationalError:
        print("     ⏭️  remote_id already exists")
    
    try:
        cursor.execute("ALTER TABLE projects ADD COLUMN dirty INTEGER DEFAULT 1")
        print("     ✅ Added dirty column")
    except sqlite3.OperationalError:
        print("     ⏭️  dirty already exists")
    
    try:
        cursor.execute("ALTER TABLE projects ADD COLUMN last_synced_ts TEXT")
        print("     ✅ Added last_synced_ts column")
    except sqlite3.OperationalError:
        print("     ⏭️  last_synced_ts already exists")
    
    # Add sync columns to pdfs table
    print("  📄 Updating pdfs table...")
    try:
        cursor.execute("ALTER TABLE pdfs ADD COLUMN remote_id INTEGER")
        print("     ✅ Added remote_id column")
    except sqlite3.OperationalError:
        print("     ⏭️  remote_id already exists")
    
    try:
        cursor.execute("ALTER TABLE pdfs ADD COLUMN dirty INTEGER DEFAULT 1")
        print("     ✅ Added dirty column")
    except sqlite3.OperationalError:
        print("     ⏭️  dirty already exists")
    
    try:
        cursor.execute("ALTER TABLE pdfs ADD COLUMN last_synced_ts TEXT")
        print("     ✅ Added last_synced_ts column")
    except sqlite3.OperationalError:
        print("     ⏭️  last_synced_ts already exists")
    
    # Create sync_metadata table
    print("  🔄 Creating sync_metadata table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    print("     ✅ sync_metadata table ready")
    
    # Initialize sync metadata
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
    
    print("✅ Database migration complete!")
    print("\n📊 What changed:")
    print("  • projects table: +remote_id, +dirty, +last_synced_ts")
    print("  • pdfs table: +remote_id, +dirty, +last_synced_ts")
    print("  • New table: sync_metadata")
    print("\n🔄 You can now use sync functionality!")


if __name__ == "__main__":
    migrate_database()
