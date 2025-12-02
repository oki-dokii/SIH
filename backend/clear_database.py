import os
import shutil
from pathlib import Path

def clear_database():
    """
    Clear the entire database and related files.
    This will delete:
    1. The SQLite database file (data/dpr.db)
    2. The db_exports folder (if it exists)
    3. All uploaded PDF files in the data directory
    """
    
    # Get the backend directory
    backend_dir = Path(__file__).parent
    project_root = backend_dir.parent
    
    deleted_items = []
    errors = []
    
    # 1. Delete the database file
    db_path = backend_dir / "data" / "dpr.db"
    if db_path.exists():
        try:
            os.remove(db_path)
            deleted_items.append(f"✓ Deleted database: {db_path}")
            print(f"✓ Deleted database: {db_path}")
        except Exception as e:
            error_msg = f"✗ Error deleting database {db_path}: {e}"
            errors.append(error_msg)
            print(error_msg)
    else:
        print(f"ℹ Database file not found: {db_path}")
    
    # 2. Delete db_exports folder (check in multiple locations)
    possible_export_locations = [
        backend_dir / "db_exports",
        project_root / "db_exports",
        backend_dir / "data" / "db_exports"
    ]
    
    for export_path in possible_export_locations:
        if export_path.exists() and export_path.is_dir():
            try:
                shutil.rmtree(export_path)
                deleted_items.append(f"✓ Deleted db_exports folder: {export_path}")
                print(f"✓ Deleted db_exports folder: {export_path}")
            except Exception as e:
                error_msg = f"✗ Error deleting db_exports {export_path}: {e}"
                errors.append(error_msg)
                print(error_msg)
    
    # 3. Delete all PDF files in the data directory
    data_dir = backend_dir / "data"
    if data_dir.exists() and data_dir.is_dir():
        pdf_files = list(data_dir.glob("*.pdf"))
        if pdf_files:
            print(f"\nFound {len(pdf_files)} PDF files to delete:")
            for pdf_file in pdf_files:
                try:
                    os.remove(pdf_file)
                    deleted_items.append(f"✓ Deleted PDF: {pdf_file.name}")
                    print(f"  ✓ Deleted: {pdf_file.name}")
                except Exception as e:
                    error_msg = f"  ✗ Error deleting {pdf_file.name}: {e}"
                    errors.append(error_msg)
                    print(error_msg)
        else:
            print("ℹ No PDF files found in data directory")
    
    # Summary
    print("\n" + "="*60)
    print("CLEANUP SUMMARY")
    print("="*60)
    print(f"Total items deleted: {len(deleted_items)}")
    
    if errors:
        print(f"\nErrors encountered: {len(errors)}")
        for error in errors:
            print(f"  {error}")
    else:
        print("\n✓ All cleanup operations completed successfully!")
    
    print("\n" + "="*60)
    print("Database has been cleared. You can now run your application")
    print("with the new schema. The database will be recreated on first use.")
    print("="*60)
    
    return len(deleted_items), len(errors)

if __name__ == "__main__":
    print("="*60)
    print("DATABASE CLEANUP SCRIPT")
    print("="*60)
    print("\nThis will delete:")
    print("  1. The SQLite database file (data/dpr.db)")
    print("  2. The db_exports folder (if found)")
    print("  3. All PDF files in the data directory")
    print("\n" + "="*60)
    
    input("Press Enter to continue or Ctrl+C to cancel...")
    
    print("\nStarting cleanup...\n")
    deleted, errors = clear_database()
    
    if errors == 0:
        print("\n✓ SUCCESS: Database cleanup completed without errors!")
    else:
        print(f"\n⚠ WARNING: Cleanup completed with {errors} error(s). Check above for details.")
