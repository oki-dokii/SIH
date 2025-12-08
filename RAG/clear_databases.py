"""
Clear all projects and dprs/pdfs from databases.
Use this to start fresh for testing sync.
"""
import sqlite3
from pathlib import Path

def clear_database(db_path, table_names):
    """Clear specified tables from database."""
    if not Path(db_path).exists():
        print(f"⚠️  Database not found: {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"\n📁 Clearing {db_path}...")
    
    for table in table_names:
        # Check if table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
        """, (table,))
        
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

if __name__ == "__main__":
    print("=" * 60)
    print("DATABASE CLEANUP - CLEAR ALL PROJECTS & DPRS")
    print("=" * 60)
    print("\n⚠️  WARNING: This will delete ALL projects and dprs/pdfs!")
    print("Press Ctrl+C to cancel or Enter to continue...")
    input()
    
    # Clear offline database (RAG)
    clear_database("data/chat.db", ["projects", "pdfs", "chunks", "messages"])
    
    # Clear cloud database (if running locally for testing)
    clear_database("cloud_backend/data/cloud.db", ["projects", "files"])
    
    print("\n" + "=" * 60)
    print("✅ CLEANUP COMPLETE!")
    print("=" * 60)
    print("\nAll local databases cleared.")
    print("Cloud backend on Render needs manual cleanup if desired.")
    print("\nRestart your servers to start fresh!")
