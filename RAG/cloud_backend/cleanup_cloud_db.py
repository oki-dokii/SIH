#!/usr/bin/env python3
"""
Cleanup script for Render cloud database.
Removes stale test projects.

Usage:
    python cleanup_cloud_db.py
"""

import sqlite3
from pathlib import Path

# Database path (adjust if needed when running on Render)
DB_PATH = "data/cloud.db"

def cleanup_stale_projects():
    """Remove test projects that are no longer needed."""
    
    print("🧹 Cleaning up stale projects from cloud database...")
    print(f"   Database: {DB_PATH}")
    
    # Projects to remove
    stale_projects = ['yt', 'trdtdkj']
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Show current projects
        cursor.execute("SELECT id, name FROM projects")
        projects = cursor.fetchall()
        print(f"\n📋 Current projects ({len(projects)}):")
        for proj_id, name in projects:
            print(f"   ID: {proj_id}, Name: {name}")
        
        # Delete stale projects
        print(f"\n🗑️  Deleting stale projects: {', '.join(stale_projects)}")
        cursor.execute(
            "DELETE FROM projects WHERE name IN (?, ?)",
            tuple(stale_projects)
        )
        deleted_count = cursor.rowcount
        
        conn.commit()
        
        # Show remaining projects
        cursor.execute("SELECT id, name FROM projects")
        remaining = cursor.fetchall()
        print(f"\n✅ Deleted {deleted_count} projects")
        print(f"📋 Remaining projects ({len(remaining)}):")
        for proj_id, name in remaining:
            print(f"   ID: {proj_id}, Name: {name}")
        
        conn.close()
        
        return deleted_count
        
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        return 0


if __name__ == "__main__":
    deleted = cleanup_stale_projects()
    print(f"\n✨ Cleanup complete! Removed {deleted} stale projects.")
