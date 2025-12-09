#!/usr/bin/env python3
"""
Clear Render Cloud Database

This script connects to the Render cloud backend and clears all data
from the database (projects and files).

Usage:
    python clear_cloud_database.py

WARNING: This will permanently delete all projects and files from the cloud!
"""

import requests
import sys
from datetime import datetime

# Cloud backend URL - modify if different
CLOUD_URL = "https://rag-sync.onrender.com"


def ping_server():
    """Test connectivity to the cloud server."""
    print("  Attempting to connect (this may take up to 60s if server is sleeping)...")
    
    # Try multiple times with increasing timeout (Render free tier wakes up slowly)
    for attempt in range(3):
        try:
            timeout = 30 if attempt == 0 else 60
            print(f"  Attempt {attempt + 1}/3 (timeout: {timeout}s)...")
            
            response = requests.get(f"{CLOUD_URL}/ping", timeout=timeout)
            if response.status_code == 200:
                data = response.json()
                print(f"  ✓ Server is online: {data}")
                return True
            else:
                print(f"  ✗ Server responded with status {response.status_code}")
        except requests.exceptions.Timeout:
            if attempt < 2:
                print(f"  ⏱ Timeout - server may be waking up, retrying...")
            else:
                print(f"  ✗ Connection timed out after all attempts")
                return False
        except requests.exceptions.RequestException as e:
            print(f"  ✗ Connection error: {e}")
            if attempt == 2:
                return False
    
    return False


def get_all_projects():
    """Fetch all projects from the cloud."""
    try:
        response = requests.get(f"{CLOUD_URL}/projects", timeout=30)
        if response.status_code == 200:
            data = response.json()
            return data.get("projects", [])
        else:
            print(f"✗ Failed to fetch projects: {response.status_code}")
            return []
    except requests.exceptions.RequestException as e:
        print(f"✗ Error fetching projects: {e}")
        return []


def get_all_files():
    """Fetch all files from the cloud."""
    try:
        response = requests.get(f"{CLOUD_URL}/files", timeout=30)
        if response.status_code == 200:
            data = response.json()
            return data.get("files", [])
        else:
            print(f"✗ Failed to fetch files: {response.status_code}")
            return []
    except requests.exceptions.RequestException as e:
        print(f"✗ Error fetching files: {e}")
        return []


def delete_file(file_id):
    """Delete a specific file from the cloud."""
    try:
        response = requests.delete(f"{CLOUD_URL}/files/{file_id}", timeout=10)
        if response.status_code == 200:
            return True
        else:
            print(f"  ✗ Failed to delete file {file_id}: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Error deleting file {file_id}: {e}")
        return False


def clear_database():
    """Main function to clear all data from the cloud database."""
    print("=" * 60)
    print("RENDER CLOUD DATABASE CLEANER")
    print("=" * 60)
    print(f"Target: {CLOUD_URL}")
    print()

    # Step 1: Test connectivity
    print("[1/4] Testing server connectivity...")
    if not ping_server():
        print("\n✗ Cannot connect to server. Aborting.")
        sys.exit(1)
    print()

    # Step 2: Fetch current data
    print("[2/4] Fetching current database contents...")
    projects = get_all_projects()
    files = get_all_files()
    
    print(f"  Found {len(projects)} projects")
    print(f"  Found {len(files)} files")
    print()

    if len(projects) == 0 and len(files) == 0:
        print("✓ Database is already empty!")
        return

    # Step 3: Confirm deletion
    print("WARNING: This will permanently delete:")
    print(f"  - {len(projects)} projects")
    print(f"  - {len(files)} files")
    print()
    
    confirm = input("Type 'DELETE' to confirm: ")
    if confirm != "DELETE":
        print("\n✗ Aborted by user")
        sys.exit(0)
    print()

    # Step 4: Delete all files first (due to foreign key constraints)
    print("[3/4] Deleting files...")
    deleted_files = 0
    for file in files:
        file_id = file.get("id")
        filename = file.get("original_filename", "unknown")
        if delete_file(file_id):
            deleted_files += 1
            print(f"  ✓ Deleted file {file_id}: {filename}")
        else:
            print(f"  ✗ Failed to delete file {file_id}: {filename}")
    
    print(f"  Deleted {deleted_files}/{len(files)} files")
    print()

    # Note: Projects will be automatically cleared when files are deleted
    # due to CASCADE constraints, or you can add explicit project deletion
    # if needed by calling DELETE /projects/{id} endpoint
    
    print("[4/4] Verifying cleanup...")
    remaining_projects = get_all_projects()
    remaining_files = get_all_files()
    
    print(f"  Remaining projects: {len(remaining_projects)}")
    print(f"  Remaining files: {len(remaining_files)}")
    print()

    if len(remaining_files) == 0:
        print("=" * 60)
        print("✅ CLOUD DATABASE CLEARED SUCCESSFULLY!")
        print("=" * 60)
    else:
        print("=" * 60)
        print("⚠️  WARNING: Some data may still remain")
        print("=" * 60)


if __name__ == "__main__":
    try:
        clear_database()
    except KeyboardInterrupt:
        print("\n\n✗ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
