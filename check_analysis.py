import sqlite3
import json

conn = sqlite3.connect('data/dpr.db')
cursor = conn.cursor()

print("=== DPRs with Analysis ===")
cursor.execute('''
    SELECT id, original_filename, project_id, upload_ts, 
           CASE 
               WHEN summary_json IS NULL THEN 'No Analysis'
               WHEN summary_json = '{}' THEN 'Empty'
               ELSE 'Has Analysis'
           END as status
    FROM dprs 
    ORDER BY id DESC 
    LIMIT 15
''')
rows = cursor.fetchall()
for r in rows:
    print(f'ID: {r[0]}, File: {r[1][:30]}, Project: {r[2]}, Status: {r[4]}, Time: {r[3][:16]}')

print("\n=== Checking for JSON parsing issues ===")
cursor.execute('SELECT id, original_filename FROM dprs WHERE summary_json IS NOT NULL AND summary_json != "{}"')
valid_dprs = cursor.fetchall()
print(f"Found {len(valid_dprs)} DPRs with analysis data")

if valid_dprs:
    # Check first one
    dpr_id = valid_dprs[0][0]
    cursor.execute('SELECT summary_json FROM dprs WHERE id = ?', (dpr_id,))
    json_str = cursor.fetchone()[0]
    try:
        data = json.loads(json_str)
        print(f"✓ DPR {dpr_id} has valid JSON with keys: {list(data.keys())[:5]}")
    except:
        print(f"✗ DPR {dpr_id} has INVALID JSON")

conn.close()
