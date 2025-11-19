import os
import json
import time
from typing import Dict, Optional
import google.generativeai as genai

# backend/gemini_client.py (add near top)
import os
from dotenv import load_dotenv

load_dotenv()  # ensure .env is loaded

# Some versions of the google-genai SDK expect genai.configure(...)
try:
    import google.generativeai as genai
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if key:
        try:
            genai.configure(api_key=key)
            print("Configured google.generativeai with GEMINI_API_KEY from .env")
        except AttributeError:
            # older/newer SDK may not have configure(); we'll still continue and rely on env var
            print("genai.configure not present; relying on GOOGLE_API_KEY env var")
except Exception as e:
    print("Could not import google.generativeai to configure automatically:", e)


# Configure Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# In-memory chat sessions: {dpr_id: chat_object}
_chat_sessions = {}


def upload_file(file_path: str) -> str:
    """
    Upload a file to Gemini Files API and wait for it to be processed.
    Returns the file reference (name/uri) that can be used in generation requests.
    
    NOTE: The exact attribute to return (uploaded_file.name vs uploaded_file.uri)
    depends on the SDK version. Currently using uploaded_file.name.
    """
    print(f"⏳ Uploading file to Gemini: {file_path}")
    start_time = time.time()
    
    # Upload the file
    uploaded_file = genai.upload_file(file_path)
    
    # Poll until the file is processed
    print(f"⏳ Waiting for file to be processed: {uploaded_file.name}")
    while uploaded_file.state.name == "PROCESSING":
        time.sleep(2)
        uploaded_file = genai.get_file(uploaded_file.name)
    
    if uploaded_file.state.name == "FAILED":
        raise ValueError(f"File processing failed: {uploaded_file.name}")
    
    elapsed = time.time() - start_time
    print(f"✓ File uploaded and processed in {elapsed:.2f}s: {uploaded_file.name}")
    
    # Return the file reference (name is stable across SDK versions)
    return uploaded_file.name


def generate_json_from_file(file_ref: str, schema_path: str) -> Dict:
    """
    Generate structured JSON from an uploaded file using Gemini.
    
    Args:
        file_ref: The file reference returned by upload_file()
        schema_path: Path to schema.json file
    
    Returns:
        Parsed JSON dict matching the schema
    """
    print(f"⏳ Generating JSON from file: {file_ref}")
    start_time = time.time()
    
    # Read the schema
    with open(schema_path, 'r') as f:
        schema_content = f.read()
    
    # Get the file object
    file_obj = genai.get_file(file_ref)
    
    # Create a strict system prompt
    system_instruction = """You are a document analyst specialized in analyzing Detailed Project Reports (DPRs). 
Your task is to extract structured information from the provided PDF document and return ONLY valid JSON that exactly matches the provided schema , There might be some hand written pages and you might get garbage text if you perform ocr on it, dont be confused , just ignore them.

CRITICAL INSTRUCTIONS:
1. RETURN ONLY VALID JSON - no markdown, no explanations, no additional text
2. Match the schema structure EXACTLY
3. Use null for missing values
4. Return numbers as plain numbers (no commas, no currency symbols)
5. Keep string values concise but informative
6. For arrays, include all relevant items mentioned in the document
7. Ensure all required top-level keys are present

Do not add any commentary before or after the JSON. Your entire response must be parseable JSON."""
    
    # Create the user prompt with schema
    user_prompt = f"""Analyze the attached PDF document and extract information according to this schema:

{schema_content}

REMEMBER: Return ONLY the JSON object. No markdown code blocks, no explanations. Just pure JSON that matches the schema exactly."""
    
    # Create the model with strict instructions
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        system_instruction=system_instruction
    )
    
    # Generate content with the file attached
    response = model.generate_content([file_obj, user_prompt])
    
    elapsed = time.time() - start_time
    print(f"✓ JSON generated in {elapsed:.2f}s (response length: {len(response.text)} chars)")
    
    # Parse and validate the JSON
    try:
        # Clean up response text (remove markdown if present)
        response_text = response.text.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        parsed_json = json.loads(response_text)
        
        # Validate that it's a dict and has basic required keys
        if not isinstance(parsed_json, dict):
            raise ValueError("Response is not a JSON object")
        
        required_keys = [
            "projectName", "projectLocation", "projectSector", 
            "executiveSummary", "overallScore", "recommendation",
            "financialAnalysis", "timelineAnalysis", "scopeAndObjectives",
            "riskAssessment", "complianceCheck"
        ]
        
        missing_keys = [key for key in required_keys if key not in parsed_json]
        if missing_keys:
            raise ValueError(f"Missing required keys: {missing_keys}")
        
        print(f"✓ JSON validated successfully")
        return parsed_json
        
    except json.JSONDecodeError as e:
        print(f"✗ JSON parsing failed: {e}")
        print(f"Raw response: {response.text[:500]}...")
        raise ValueError(f"Failed to parse JSON from Gemini response: {str(e)}")


def create_chat_session(dpr_id: int, file_ref: str) -> None:
    """
    Create a new chat session for a DPR if it doesn't exist.
    
    Args:
        dpr_id: The DPR ID
        file_ref: The file reference for the DPR document
    """
    if dpr_id in _chat_sessions:
        return
    
    print(f"⏳ Creating chat session for DPR {dpr_id}")
    
    # Get the file object
    file_obj = genai.get_file(file_ref)
    
    # Create model with system instructions for chat
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        system_instruction="""You are a helpful assistant analyzing a Detailed Project Report (DPR).
When answering questions:
1. Reference specific information from the document
2. Cite pages or sections when possible using format: (page: X) or (section: Y)
3. Be concise but comprehensive.
4. Reply only with text without any formatting.
5. If information is not in the document, say so clearly
6. Do not make up or hallucinate page numbers or facts"""
    )
    
    # Start chat with the document
    chat = model.start_chat(history=[])
    
    # Store the chat session and file reference
    _chat_sessions[dpr_id] = {
        'chat': chat,
        'file': file_obj
    }
    
    print(f"✓ Chat session created for DPR {dpr_id}")


def send_chat_message(dpr_id: int, message: str, file_ref: str) -> Dict:
    """
    Send a message in the chat session and get a response.
    
    Args:
        dpr_id: The DPR ID
        message: User's message
        file_ref: The file reference for the DPR document
    
    Returns:
        Dict with 'reply' and optionally 'sources'
    """
    print(f"⏳ Processing chat message for DPR {dpr_id}")
    start_time = time.time()
    
    # Create session if it doesn't exist
    if dpr_id not in _chat_sessions:
        create_chat_session(dpr_id, file_ref)
    
    session = _chat_sessions[dpr_id]
    chat = session['chat']
    file_obj = session['file']
    
    # Send message with file context
    response = chat.send_message([file_obj, message])
    
    elapsed = time.time() - start_time
    print(f"✓ Chat response generated in {elapsed:.2f}s (length: {len(response.text)} chars)")
    
    return {
        'reply': response.text,
        'sources': []  # Gemini will include sources in text if instructed properly
    }


# Fallback note for REST API implementation:
# TODO: If google-generativeai SDK is not available, implement REST API fallback:
# - File upload: POST https://generativelanguage.googleapis.com/v1beta/files
# - File status: GET https://generativelanguage.googleapis.com/v1beta/files/{name}
# - Generate: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
# - Use Authorization: Bearer {GEMINI_API_KEY} header
# - See: https://ai.google.dev/api/rest