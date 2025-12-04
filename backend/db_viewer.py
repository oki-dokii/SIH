#!/usr/bin/env python3
"""
Database Viewer Utility
Exports all database tables to JSON and CSV files for inspection.
"""

import sqlite3
import json
import csv
import os
from datetime import datetime
from pathlib import Path


def export_database(db_path: str = "data/dpr.db", output_dir: str = "db_exports"):
    """Export all tables from the database to JSON and CSV files."""
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    # Create timestamp for this export
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    export_folder = output_path / f"export_{timestamp}"
    export_folder.mkdir(exist_ok=True)
    
    print(f"📊 Exporting database from: {db_path}")
    print(f"📁 Output directory: {export_folder}\n")
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all table names
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    """)
    
    tables = [row[0] for row in cursor.fetchall()]
    
    print(f"Found {len(tables)} tables: {', '.join(tables)}\n")
    print("=" * 80)
    
    stats = {}
    
    for table_name in tables:
        print(f"\n📋 Exporting table: {table_name}")
        print("-" * 80)
        
        # Get table schema
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns_info = cursor.fetchall()
        columns = [col[1] for col in columns_info]
        
        print(f"Columns: {', '.join(columns)}")
        
        # Get all rows
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        
        row_count = len(rows)
        stats[table_name] = row_count
        print(f"Row count: {row_count}")
        
        # Convert to list of dicts
        data = []
        for row in rows:
            row_dict = dict(zip(columns, row))
            
            # Pretty-print JSON fields for better readability
            for key, value in row_dict.items():
                if key in ['summary_json', 'summary_json_multilang'] and value:
                    try:
                        # Parse and re-format JSON for pretty printing
                        parsed = json.loads(value) if isinstance(value, str) else value
                        row_dict[key] = parsed
                    except:
                        pass  # Keep as is if not valid JSON
            
            data.append(row_dict)
        
        # Export to JSON
        json_file = export_folder / f"{table_name}.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"✓ JSON exported to: {json_file.name}")
        
        # Export to CSV
        if data:
            csv_file = export_folder / f"{table_name}.csv"
            with open(csv_file, 'w', newline='', encoding='utf-8') as f:
                # For CSV, convert complex JSON fields to strings
                csv_data = []
                for row in data:
                    csv_row = {}
                    for key, value in row.items():
                        if isinstance(value, (dict, list)):
                            csv_row[key] = json.dumps(value, ensure_ascii=False)
                        else:
                            csv_row[key] = value
                    csv_data.append(csv_row)
                
                writer = csv.DictWriter(f, fieldnames=columns)
                writer.writeheader()
                writer.writerows(csv_data)
            print(f"✓ CSV exported to: {csv_file.name}")
    
    conn.close()
    
    # Create summary report
    print("\n" + "=" * 80)
    print("📊 EXPORT SUMMARY")
    print("=" * 80)
    
    summary = {
        "export_timestamp": datetime.now().isoformat(),
        "database_path": db_path,
        "tables": stats,
        "total_rows": sum(stats.values())
    }
    
    # Save summary
    summary_file = export_folder / "summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\nTotal tables: {len(tables)}")
    print(f"Total rows across all tables: {summary['total_rows']}")
    print("\nRows per table:")
    for table, count in stats.items():
        print(f"  • {table}: {count} rows")
    
    print(f"\n✓ Export complete! Files saved to: {export_folder}")
    print(f"✓ Summary saved to: {summary_file.name}")
    
    return export_folder


def print_schema(db_path: str = "data/dpr.db"):
    """Print detailed schema information for all tables."""
    
    print("\n" + "=" * 80)
    print("📐 DATABASE SCHEMA")
    print("=" * 80)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    """)
    
    tables = [row[0] for row in cursor.fetchall()]
    
    for table_name in tables:
        print(f"\n📋 Table: {table_name}")
        print("-" * 80)
        
        # Get table schema
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        
        print(f"{'Column':<30} {'Type':<15} {'Null':<8} {'Default':<15} {'PK':<5}")
        print("-" * 80)
        
        for col in columns:
            cid, name, col_type, not_null, default, pk = col
            null_str = "NOT NULL" if not_null else "NULL"
            default_str = str(default) if default is not None else ""
            pk_str = "PK" if pk else ""
            
            print(f"{name:<30} {col_type:<15} {null_str:<8} {default_str:<15} {pk_str:<5}")
        
        # Get foreign keys
        cursor.execute(f"PRAGMA foreign_key_list({table_name})")
        fks = cursor.fetchall()
        
        if fks:
            print("\n  Foreign Keys:")
            for fk in fks:
                fk_id, seq, table, from_col, to_col = fk[0], fk[1], fk[2], fk[3], fk[4]
                print(f"    • {from_col} → {table}({to_col})")
        
        # Get indexes
        cursor.execute(f"PRAGMA index_list({table_name})")
        indexes = cursor.fetchall()
        
        if indexes:
            print("\n  Indexes:")
            for idx in indexes:
                idx_name, unique, origin = idx[1], idx[2], idx[3]
                unique_str = "(UNIQUE)" if unique else ""
                print(f"    • {idx_name} {unique_str}")
    
    conn.close()
    print("\n" + "=" * 80 + "\n")


def interactive_query(db_path: str = "data/dpr.db"):
    """Interactive mode to run custom queries."""
    
    print("\n" + "=" * 80)
    print("🔍 INTERACTIVE QUERY MODE")
    print("=" * 80)
    print("Enter SQL queries to execute. Type 'exit' to quit.\n")
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    while True:
        try:
            query = input("\nSQL> ").strip()
            
            if query.lower() in ['exit', 'quit', 'q']:
                break
            
            if not query:
                continue
            
            cursor.execute(query)
            
            if query.lower().startswith('select'):
                rows = cursor.fetchall()
                
                if rows:
                    columns = rows[0].keys()
                    
                    # Print results in table format
                    print(f"\nResults: {len(rows)} rows")
                    print("-" * 80)
                    
                    # Print header
                    header = " | ".join(f"{col:<20}"[:20] for col in columns)
                    print(header)
                    print("-" * 80)
                    
                    # Print rows
                    for row in rows:
                        values = []
                        for val in row:
                            if isinstance(val, str) and len(val) > 20:
                                values.append(val[:17] + "...")
                            else:
                                values.append(str(val) if val is not None else "NULL")
                        
                        print(" | ".join(f"{val:<20}"[:20] for val in values))
                else:
                    print("No results")
            else:
                conn.commit()
                print(f"✓ Query executed successfully")
        
        except Exception as e:
            print(f"❌ Error: {e}")
    
    conn.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database Viewer Utility")
    parser.add_argument("--db", default="data/dpr.db", help="Path to database file")
    parser.add_argument("--export", action="store_true", help="Export all tables to JSON/CSV")
    parser.add_argument("--schema", action="store_true", help="Print database schema")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interactive query mode")
    parser.add_argument("--output", default="db_exports", help="Output directory for exports")
    
    args = parser.parse_args()
    
    # Check if database exists
    if not os.path.exists(args.db):
        print(f"❌ Database not found: {args.db}")
        exit(1)
    
    # Default: run all if no specific option is chosen
    if not (args.export or args.schema or args.interactive):
        args.export = True
        args.schema = True
    
    if args.schema:
        print_schema(args.db)
    
    if args.export:
        export_database(args.db, args.output)
    
    if args.interactive:
        interactive_query(args.db)
