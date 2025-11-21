import re

# Read the file
with open('backend/db.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace in get_all_comparison_chats function
# Add message count query after pdf_count query
old_pattern = r'(pdf_count = cursor\.fetchone\(\)\["pdf_count"\]\s+chats\.append\({)'
new_code = '''pdf_count = cursor.fetchone()["pdf_count"]
        
        # Get count of messages in this comparison
        cursor.execute("""
            SELECT COUNT(*) as message_count
            FROM comparison_messages
            WHERE comparison_chat_id = ?
        """, (comparison_id,))
        
        message_count = cursor.fetchone()["message_count"]
        
        chats.append({'''

content = re.sub(old_pattern, new_code, content)

# Also add message_count to the appended dictionary
old_dict = r'("pdf_count": pdf_count\s+})'
new_dict = '''"pdf_count": pdf_count,
            "message_count": message_count
        }'''

content = re.sub(old_dict, new_dict, content)

# Write back
with open('backend/db.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Added message_count to get_all_comparison_chats!")
