import os
import shutil
from pathlib import Path

def clear_database():
    """
    Clear the entire database and related files.
    """
    
    # Get the backend directory
    backend_dir = Path(__file__).parent
    project_root = backend_dir.parent
    
    deleted_count = 0
    
    print("="*60)
    print("DATABASE CLEANUP - STARTING")
    print("="*60)
    
    # 1. Delete the database file
    db_path = backend_dir / "data" / "dpr.db"
    print(f"\nChecking for database: {db_path}")
    if db_path.exists():
        os.remove(db_path)
        print(f"✓ DELETED: Database file")
        deleted_count += 1
    else:
        print(f"  Database file does not exist (already clean)")
    
    # 2. Delete db_exports folder
    possible_export_locations = [
        backend_dir / "db_exports",
        project_root / "db_exports",
        backend_dir / "data" / "db_exports"
    ]
    
    print(f"\nChecking for db_exports folder...")
    found_exports = False
    for export_path in possible_export_locations:
        if export_path.exists() and export_path.is_dir():
            shutil.rmtree(export_path)
            print(f"✓ DELETED: db_exports folder at {export_path}")
            deleted_count += 1
            found_exports = True
    
    if not found_exports:
        print(f"  db_exports folder does not exist (already clean)")
    
    # 3. Delete all PDF files in the data directory
    data_dir = backend_dir / "data"
    print(f"\nChecking for PDF files in: {data_dir}")
    if data_dir.exists() and data_dir.is_dir():
        pdf_files = list(data_dir.glob("*.pdf"))
        if pdf_files:
            print(f"Found {len(pdf_files)} PDF files:")
            for pdf_file in pdf_files:
                os.remove(pdf_file)
                print(f"  ✓ DELETED: {pdf_file.name}")
                deleted_count += 1
        else:
            print("  No PDF files found (already clean)")
    
    # Summary
    print("\n" + "="*60)
    print("CLEANUP COMPLETE")
    print("="*60)
    print(f"Total items deleted: {deleted_count}")
    print("\nThe database has been cleared successfully!")
    print("It will be recreated with the new schema on first use.")
    print("="*60)
    
    return deleted_count

if __name__ == "__main__":
    clear_database()
