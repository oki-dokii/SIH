import re

# Read the file
with open('backend/app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update UserRegisterRequest - remove username field
content = re.sub(
    r'class UserRegisterRequest\(BaseModel\):\r?\n    name: str\r?\n    username: str\r?\n    email: str',
    'class UserRegisterRequest(BaseModel):\n    name: str\n    email: str',
    content
)

# 2. Update UserLoginRequest - change username to email
content = re.sub(
    r'class UserLoginRequest\(BaseModel\):\r?\n    username: str\r?\n    password: str',
    'class UserLoginRequest(BaseModel):\n    email: str\n    password: str',
    content
)

# 3. Remove username validation
content = re.sub(
    r'    # Validate username \(alphanumeric\)\r?\n    if not request\.username\.isalnum\(\):\r?\n        raise HTTPException\(status_code=400, detail="Username must be alphanumeric"\)\r?\n    \r?\n',
    '',
    content
)

# 4. Update create_user call - remove username parameter
content = re.sub(
    r'user_id = db\.create_user\(request\.username, request\.email, password_hash, request\.name\)',
    'user_id = db.create_user(request.email, password_hash, request.name)',
    content
)

# 5. Update registration response - remove username
content = re.sub(
    r'"user": \{\r?\n                "id": user_id,\r?\n                "name": request\.name,\r?\n                "username": request\.username,\r?\n                "email": request\.email\r?\n            \}',
    '"user": {\n                "id": user_id,\n                "name": request.name,\n                "email": request.email\n            }',
    content
)

# 6. Update error message comment
content = re.sub(
    r'# Handle duplicate username/email',
    '# Handle duplicate email',
    content
)

# 7. Update login endpoint - change get_user_by_username to get_user_by_email
content = re.sub(
    r'# Get user by username\r?\n        user = db\.get_user_by_username\(request\.username\)',
    '# Get user by email\n        user = db.get_user_by_email(request.email)',
    content
)

# 8. Update login response - remove username
content = re.sub(
    r'"user": \{\r?\n                "id": user\["id"\],\r?\n                "name": user\["name"\],\r?\n                "username": user\["username"\],\r?\n                "email": user\["email"\]\r?\n            \}',
    '"user": {\n                "id": user["id"],\n                "name": user["name"],\n                "email": user["email"]\n            }',
    content
)

# Write back
with open('backend/app.py', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(content)

print("✓ Successfully updated app.py")
