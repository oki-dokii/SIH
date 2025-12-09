"""
Script to clear all projects and DPRs from the database and delete associated PDF files.
This will preserve the database schema but remove all data.
"""

import sqlite3
import os
from pathlib import Path

# Database path
DB_PATH = Path("data/dpr.db")
DATA_DIR = Path("data")

def clear_database():
    """Clear all data from the database while preserving schema."""
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        # Get all PDF filepaths before deleting from database
        cursor.execute("SELECT filepath FROM dprs")
        pdf_files = [row[0] for row in cursor.fetchall()]
        
        print(f"📊 Found {len(pdf_files)} PDF files to delete")
        
        # Delete all data from tables (in correct order due to foreign keys)
        tables_to_clear = [
            "messages",
            "comparison_messages",
            "comparison_chat_pdfs",
            "comparison_chats",
            "client_dprs",
            "dprs",
            "projects",
            "users"
        ]
        
        for table in tables_to_clear:
            cursor.execute(f"DELETE FROM {table}")
            deleted_count = cursor.rowcount
            print(f"✓ Cleared {deleted_count} records from {table}")
        
        # Reset auto-increment counters
        cursor.execute("DELETE FROM sqlite_sequence")
        print("✓ Reset auto-increment counters")
        
        conn.commit()
        print("✓ Database cleared successfully")
        
        # Delete PDF files
        deleted_files = 0
        for filepath in pdf_files:
            file_path = Path(filepath)
            if file_path.exists():
                try:
                    file_path.unlink()
                    deleted_files += 1
                    print(f"  🗑️  Deleted: {file_path.name}")
                except Exception as e:
                    print(f"  ⚠️  Failed to delete {file_path.name}: {e}")
        
        print(f"\n✓ Deleted {deleted_files} PDF files")
        
        # Show remaining files in data directory
        remaining_files = [f for f in DATA_DIR.glob("*.pdf")]
        if remaining_files:
            print(f"\n⚠️  {len(remaining_files)} PDF files still remain in data directory:")
            for f in remaining_files:
                print(f"  - {f.name}")
        else:
            print("\n✓ All PDF files removed from data directory")
        
    except Exception as e:
        print(f"❌ Error clearing database: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("DATABASE CLEANUP SCRIPT")
    print("=" * 60)
    print("\n⚠️  WARNING: This will delete ALL projects and DPRs!")
    print("This action cannot be undone.\n")
    
    response = input("Are you sure you want to continue? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        print("\n🔄 Starting cleanup...\n")
        clear_database()
        print("\n" + "=" * 60)
        print("CLEANUP COMPLETE")
        print("=" * 60)
    else:
        print("\n❌ Cleanup cancelled")
