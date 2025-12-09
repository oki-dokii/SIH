import re

# Read the file
with open('backend/db.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add get_user_by_email function after get_user_by_username
get_user_by_email_func = '''

def get_user_by_email(email: str, db_path: str = "data/dpr.db") -> Optional[Dict]:
    """Retrieve a user by email."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, email, password_hash, name, created_at
        FROM users WHERE email = ?
    """, (email,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row["id"],
            "username": row["username"] if "username" in row.keys() else None,
            "email": row["email"],
            "password_hash": row["password_hash"],
            "name": row["name"],
            "created_at": row["created_at"]
        }
    return None
'''

# Find the location after get_user_by_username function and insert
content = re.sub(
    r'(def get_user_by_username.*?return None\r?\n)',
    r'\1' + get_user_by_email_func,
    content,
    flags=re.DOTALL
)

# 2. Update create_user function signature and implementation
# Make username optional/nullable, email is now required first parameter
content = re.sub(
    r'def create_user\(username: str, email: str, password_hash: str, name: str = None',
    'def create_user(email: str, password_hash: str, name: str = None, username: str = None',
    content
)

# Update the INSERT statement to make username optional
content = re.sub(
    r'cursor\.execute\("""\r?\n            INSERT INTO users \(username, email, password_hash, name, created_at\)\r?\n            VALUES \(\?, \?, \?, \?, \?\)\r?\n        """, \(username, email, password_hash, name, timestamp\)\)',
    '''cursor.execute("""
            INSERT INTO users (email, password_hash, name, username, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (email, password_hash, name, username, timestamp))''',
    content
)

# Update error handling for email uniqueness
content = re.sub(
    r"if 'username' in str\(e\):\r?\n            raise ValueError\(\"Username already exists\"\)",
    "if 'email' in str(e) or 'UNIQUE' in str(e):\n            raise ValueError(\"Email already exists\")",
    content
)

# 3. Add database migration for email unique constraint in init_db
# Find the users table creation and add email unique constraint migration
migration_code = '''
    
    # MIGRATION: Add UNIQUE constraint on email if not exists
    cursor.execute("PRAGMA table_info(users)")
    users_columns = cursor.fetchall()
    
    # Check if email has unique constraint by checking indexes
    cursor.execute("PRAGMA index_list(users)")
    indexes = cursor.fetchall()
    has_email_unique = any('email' in str(idx) for idx in indexes)
    
    if not has_email_unique:
        print("⏳ Migrating database: adding UNIQUE constraint on email...")
        try:
            cursor.execute("PRAGMA foreign_keys=off;")
            cursor.execute("BEGIN TRANSACTION;")
            
            # Create new users table with email UNIQUE constraint
            cursor.execute("""
                CREATE TABLE users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    name TEXT,
                    username TEXT,
                    created_at TEXT NOT NULL
                )
            """)
            
            # Copy data from old table
            cursor.execute("""
                INSERT INTO users_new (id, email, password_hash, name, username, created_at)
                SELECT id, email, password_hash, name, username, created_at FROM users
            """)
            
            # Drop old table and rename new one
            cursor.execute("DROP TABLE users")
            cursor.execute("ALTER TABLE users_new RENAME TO users")
            
            # Recreate email unique index
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
                ON users(email)
            """)
            
            cursor.execute("COMMIT;")
            cursor.execute("PRAGMA foreign_keys=on;")
            print("✓ Database migration complete (email UNIQUE constraint added)")
        except Exception as e:
            cursor.execute("ROLLBACK;")
            print(f"⚠ Email uniqueness migration failed: {e}")
'''

# Insert the migration code after the username index creation
content = re.sub(
    r'(CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username.*?ON users\(username\)\r?\n.*?""".*?\))',
    r'\1' + migration_code,
    content,
    flags=re.DOTALL
)

# Write back
with open('backend/db.py', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(content)

print("✓ Successfully updated db.py")
