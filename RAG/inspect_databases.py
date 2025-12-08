"""
Script to inspect all database structures in the RAG project
"""
import sqlite3
import json
from pathlib import Path

def inspect_database(db_path, db_name):
    """Inspect a SQLite database and return schema information"""
    if not Path(db_path).exists():
        return {"error": f"Database not found: {db_path}"}
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row[0] for row in cursor.fetchall()]
    
    schema_info = {
        "database_name": db_name,
        "database_path": db_path,
        "tables": {}
    }
    
    for table in tables:
        # Get table schema
        cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}';")
        schema = cursor.fetchone()
        
        # Get column info
        cursor.execute(f"PRAGMA table_info({table});")
        columns = cursor.fetchall()
        
        # Get row count
        cursor.execute(f"SELECT COUNT(*) FROM {table};")
        row_count = cursor.fetchone()[0]
        
        # Get indexes
        cursor.execute(f"PRAGMA index_list({table});")
        indexes = cursor.fetchall()
        
        schema_info["tables"][table] = {
            "schema": schema[0] if schema else None,
            "columns": [
                {
                    "cid": col[0],
                    "name": col[1],
                    "type": col[2],
                    "not_null": bool(col[3]),
                    "default_value": col[4],
                    "primary_key": bool(col[5])
                }
                for col in columns
            ],
            "row_count": row_count,
            "indexes": [
                {
                    "seq": idx[0],
                    "name": idx[1],
                    "unique": bool(idx[2])
                }
                for idx in indexes
            ]
        }
    
    conn.close()
    return schema_info

# Inspect all databases
databases = [
    ("data/chat.db", "Local Chat Database (chat.db)"),
    ("online_project/data/dpr.db", "Online DPR Database (dpr.db)"),
    ("chroma_db/chroma.sqlite3", "ChromaDB Vector Store (Main)"),
    ("sectional_chroma_db/chroma.sqlite3", "ChromaDB Vector Store (Sectional)")
]

results = {}

for db_path, db_name in databases:
    print(f"\n{'='*80}")
    print(f"Inspecting: {db_name}")
    print(f"Path: {db_path}")
    print(f"{'='*80}")
    
    info = inspect_database(db_path, db_name)
    results[db_name] = info
    
    if "error" in info:
        print(f"ERROR: {info['error']}")
        continue
    
    print(f"\nFound {len(info['tables'])} tables:")
    for table_name, table_info in info['tables'].items():
        print(f"\n  Table: {table_name}")
        print(f"  Rows: {table_info['row_count']}")
        print(f"  Columns: {len(table_info['columns'])}")
        for col in table_info['columns']:
            pk = " [PRIMARY KEY]" if col['primary_key'] else ""
            nn = " [NOT NULL]" if col['not_null'] else ""
            default = f" [DEFAULT: {col['default_value']}]" if col['default_value'] else ""
            print(f"    - {col['name']}: {col['type']}{pk}{nn}{default}")

# Save to JSON file
output_path = "database_inspection_results.json"
with open(output_path, 'w') as f:
    json.dump(results, f, indent=2)

print(f"\n\n{'='*80}")
print(f"Full results saved to: {output_path}")
print(f"{'='*80}")
