import os
import json
import time
import asyncio
from typing import Dict, Optional
import google.generativeai as genai
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


# Custom exception for expired file references
class FileExpiredError(Exception):
    """Raised when a Gemini file reference has expired (404/403)."""
    pass


# In-memory chat sessions: {dpr_id: chat_object}
_chat_sessions = {}


async def upload_file(file_path: str) -> str:
    """
    Upload a file to Gemini Files API and wait for it to be processed.
    Returns the file reference (name/uri) that can be used in generation requests.
    """
    print(f"⏳ Uploading file to Gemini: {file_path}")
    start_time = time.time()
    
    # Upload the file (blocking call offloaded to thread)
    uploaded_file = await asyncio.to_thread(genai.upload_file, file_path)
    
    # Poll until the file is processed
    print(f"⏳ Waiting for file to be processed: {uploaded_file.name}")
    while uploaded_file.state.name == "PROCESSING":
        await asyncio.sleep(2)
        uploaded_file = await asyncio.to_thread(genai.get_file, uploaded_file.name)
    
    if uploaded_file.state.name == "FAILED":
        raise ValueError(f"File processing failed: {uploaded_file.name}")
    
    elapsed = time.time() - start_time
    print(f"✓ File uploaded and processed in {elapsed:.2f}s: {uploaded_file.name}")
    
    # Return the file reference (name is stable across SDK versions)
    return uploaded_file.name


async def generate_json_from_file(file_ref: str, schema_path: str) -> Dict:
    """
    Generate structured JSON from an uploaded file using Gemini in English only.
    """
    print(f"⏳ Generating JSON from file: {file_ref}")
    start_time = time.time()
    
    # Read the schema
    with open(schema_path, 'r') as f:
        schema_content = f.read()
    
    # Create a strict system prompt (English only)
    system_instruction = f"""You are an expert project analyst for Detailed Project Reports (DPRs). Read the attached PDF and produce EXACTLY one valid JSON object containing analysis in English.

MANDATORY BEHAVIOR:
1) OUTPUT: Return exactly one JSON object. Do NOT add markdown or extra text.
2) ANALYZE & INFER: You must both extract explicit values from the PDF and also ANALYZE the information and INFER values where the document does not state them. In particular you MUST compute:
   - overallScore: a numeric score 0-100 (see scoring rubric below). Do NOT return null for overallScore.
   - recommendation: one of exactly ["Approved","Approved with Conditions","Rejected","Needs Review"]. Do NOT return null.
   - financialAnalysis: populate numeric fields (if missing, infer conservatively and explain).
   - riskAssessment: identify top risks, severity and evidence (these are analytical outputs).
3) REQUIRED NON-NULL FIELDS: The following fields MUST NOT be null (fill them or infer if missing): 
   `"projectName"`, `"projectLocation.state"`, `"projectSector"`, `"executiveSummary"`, `"overallScore"`, `"recommendation"`, and the entire `"financialAnalysis"` object.
   Note: `"projectLocation.districts"` is allowed to be an empty array or null if districts are absent.
4) TRACEABILITY: If you infer or compute any field (overallScore, recommendation, any financial number, or risk severity), PREPEND a single concise explanation sentence (≤25 words) at the START of the `assumptions` array. That sentence MUST begin exactly with `INFERRED_REASON:` (example: `INFERRED_REASON: Converted 4.5/5 scale to 90/100 and used NPV>0 as supporting evidence`).
5) PREFER TABULAR SOURCES: When numbers conflict, prefer table values (tables > paragraph text). If you choose one source over another, state that choice in an `INFERRED_REASON:` assumption.
6) FORMATTING RULES: 
   - Numbers must be plain JSON numbers (no commas, no currency symbols, no percent signs). If the source uses percent signs or another scale, convert to numeric form (explain conversion in `INFERRED_REASON:`).
   - Arrays must be arrays. Strings should be concise.
7) PAGE REFERENCES & EVIDENCE: For any numeric or tabular value you cite, include page references in the `assumptions` text or in the `riskAssessment[*].evidence` field (e.g., "table on page 12"). Prefer adding page numbers for `key_tables` if you identify them.
8) RISK ANALYSIS: For `riskAssessment`, list the top 3-6 risks with a one-line mitigation each. For each risk include severity: HIGH / MEDIUM / LOW, and a brief evidence note (page/table).
9) SCORING & RECOMMENDATION MAPPING: Compute `overallScore` using the rubric below; map recommendation by thresholds (but you may deviate only if you explain in `INFERRED_REASON:`).

10) **MANDATORY FINANCIAL VALIDATION** (CRITICAL - MUST DO):
   - **REQUIRED**: Sum of projectCost components (capitalExpenditureLakhINR + workingCapitalLakhINR + contingencyLakhINR + marginMoneyLakhINR + culturalCostLakhINR) MUST EQUAL totalInitialInvestmentLakhINR
   - **REQUIRED**: Sum of capitalStructure components (all Lakh fields) MUST EQUAL totalInitialInvestmentLakhINR
   - **REQUIRED**: If source document values don't add up, RECALCULATE and NORMALIZE them so they balance. Prioritize tabular values.
   - If you adjust any financial values to make them balance, add `FINANCIAL_VALIDATION:` explanation to assumptions
   - This validation is NON-NEGOTIABLE: do not return mismatched totals

10a) **COST BREAKDOWN EXTRACTION** (CRITICAL - MUST DO):
   - **REQUIRED**: Extract ALL cost components from the DPR and populate the `costBreakdown` array
   - Each cost breakdown item MUST have: `component` (name), `amountLakhINR` (exact amount), `percent` (percentage of total)
   - Extract EXACT values from tables, charts, or text - DO NOT HALLUCINATE or make up values
   - Common components include: Land Acquisition, Building/Construction, Machinery/Equipment, Pre-operative Expenses, Working Capital, Contingency, etc.
   - If the DPR shows a cost breakdown table or pie chart, extract ALL items from it
   - The sum of all `amountLakhINR` in costBreakdown should approximately equal totalInitialInvestmentLakhINR
   - The sum of all `percent` values should approximately equal 100
   - If percentages are not provided in the document, calculate them: (componentAmount / totalCost) * 100
   - Include page references in assumptions if extracting from specific tables/pages

11) **INCONSISTENCY DETECTION** (CRITICAL):
   Thoroughly analyze the DPR for inconsistencies and populate the `inconsistencyDetection` object:
   - **FLAG AS CRITICAL ISSUE** if financial components don't sum correctly
   - Verify beneficiary counts are consistent across sections
   - Identify timeline conflicts (duration vs milestones, unrealistic deadlines)
   - Detect calculation errors (ROI, IRR, payback periods)
   - Find conflicting data between sections
   - For EACH issue: provide category, severity (Critical/High/Medium/Low), description, location, detected values, impact
   - Set `hasInconsistencies` to true if ANY issues found
   - Count total inconsistencies accurately

12) **MDONER COMPLIANCE SCORING** (CRITICAL):
   Calculate weighted compliance score in `mdonerComplianceScoring`:
   - **North Eastern Focus (25%)**: NE states location? NE-specific challenges addressed? Score 0-100
   - **Beneficiary Alignment (20%)**: Tribal/marginalized communities targeted? Realistic counts? Score 0-100
   - **Environmental Compliance (20%)**: Clearances identified? Impacts assessed? Sensitive zones flagged? Score 0-100
   - **Land Acquisition (15%)**: Ownership clear? Tribal rights addressed? Consent documented? Score 0-100
   - **Documentation Quality (10%)**: DPR complete? Data consistent? Evidence provided? Score 0-100
   - **Financial Viability (10%)**: Budget realistic? IRR/DSCR acceptable? Projections sound? Score 0-100
   - Calculate `overallComplianceScore` = (northEasternFocus*0.25 + beneficiaryAlignment*0.20 + environmentalCompliance*0.20 + landAcquisition*0.15 + documentationQuality*0.10 + financialViability*0.10)
   - List specific compliance gaps and strengths

13) **SMART RECOMMENDATIONS** (CRITICAL):
   Generate actionable recommendations in `smartRecommendations`:
   - **Critical Actions**: Must-fix items before approval (address Critical inconsistencies, mandatory gaps)
   - **Improvement Suggestions**: Enhancements to strengthen project (Medium/High inconsistencies, weak compliance areas)
   - **Best Practices**: MDoNER and industry best practices to adopt
   - **Next Steps**: Prioritized actionable steps (1st, 2nd priority, etc.)
   - Be specific, actionable, reference sections/pages

14) JSON ONLY: Your entire response must be parseable JSON ONLY. No extra lines or text.

Scoring rubric (apply to compute overallScore 0-100):
- Weighted components (approx): Financial viability (NPV/IRR/Payback) 45%, Market & demand 15%, Technical readiness 15%, Team/governance 10%, Risks/residual 15%.
- Translate financial signals into a subscore (0-100): strong positive NPV & IRR → high subscore (85–100); moderate → 60–84; marginal/negative → 0-59. If you convert scales state the conversion in `INFERRED_REASON:`.
- Recommendation thresholds (default):
  - overallScore ≥ 80 → "Approved"
  - 60 ≤ overallScore < 80 → "Approved with Conditions"
  - 40 ≤ overallScore < 60 → "Needs Review"
  - overallScore < 40 → "Rejected"

Follow the rubric and trace any deviations. Return only the JSON object.
"""

    
    # Create the user prompt with schema
    user_prompt = f"""Analyze the attached PDF and return EXACTLY one JSON object following the schema below.

SCHEMA:
{schema_content}

ADDITIONAL INSTRUCTIONS:
- **FINANCIAL VALIDATION (MANDATORY)**: Sum(projectCost components) = totalInitialInvestment AND Sum(capitalStructure components) = totalInitialInvestment. Adjust/normalize values if needed and document in assumptions with `FINANCIAL_VALIDATION:` prefix.
- **COST BREAKDOWN (MANDATORY)**: Extract ALL cost components from the DPR into the `costBreakdown` array. Each item must have exact `component` name, `amountLakhINR`, and `percent`. Extract from tables/charts/text - do NOT make up values. Sum of amounts should equal total cost.
- overallScore: compute a number 0-100 using document evidence and the rubric in the system instruction.
- recommendation: one of ["Approve","Approve with Conditions","Reject","Review"].
- financialAnalysis: populate numeric fields. If a numeric value is missing, infer conservatively and explain with `INFERRED_REASON:` in assumptions.
- riskAssessment: list top 3-6 risks; for each risk include a one-line mitigation and include page/table evidence in the evidence field.
- projectLocation.districts may be [], null, or list; other required fields above must be non-null.
- When you infer or use a conversion, prepend a single `INFERRED_REASON:` sentence at the START of the assumptions array.
- Use tables over narrative when numbers conflict and indicate the chosen source in `INFERRED_REASON:`.
- Always include page references for key numeric citations where possible.

Now analyze the attached file and return EXACTLY the one JSON object described above. No extra text."""
    
    # Create the model with strict instructions
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        system_instruction=system_instruction
    )
    
    def _generate():
        file_obj = genai.get_file(file_ref)
        return model.generate_content([file_obj, user_prompt])

    response = await asyncio.to_thread(_generate)
    
    elapsed = time.time() - start_time
    print(f"✓ JSON generated in {elapsed:.2f}s (response length: {len(response.text)} chars)")
    
    # Parse and validate the JSON
    try:
        # Clean up response text (remove markdown if present)
        response_text = response.text.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        elif response_text.startswith('```'):
            response_text = response_text[3:]
        
        if response_text.endswith('```'):
            response_text = response_text[:-3]
            
        response_text = response_text.strip()
        
        try:
            parsed_json = json.loads(response_text)
        except json.JSONDecodeError:
            print("⚠ Initial JSON parse failed, attempting robust extraction...")
            # Fallback: try to find JSON object boundaries
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                json_str = response_text[start_idx:end_idx+1]
                parsed_json = json.loads(json_str)
                print("✓ Robust extraction succeeded")
            else:
                raise
        
        # Validate structure
        if not isinstance(parsed_json, dict):
            raise ValueError("Response is not a JSON object")
        
        # Validate required keys
        required_keys = [
            "projectName", "projectLocation", "projectSector", 
            "executiveSummary", "overallScore", "recommendation",
            "financialAnalysis", "timelineAnalysis", "scopeAndObjectives",
            "riskAssessment", "environmentalImpact",
            "inconsistencyDetection", "mdonerComplianceScoring", "smartRecommendations"
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


async def create_chat_session(dpr_id: int, file_ref: str) -> None:
    """
    Create a new chat session for a DPR if it doesn't exist.
    """
    if dpr_id in _chat_sessions:
        return
    
    print(f"⏳ Creating chat session for DPR {dpr_id}")
    
    def _create_session():
        try:
            # Get the file object
            file_obj = genai.get_file(file_ref)
            
            # Check if file is still valid
            if file_obj.state.name == "FAILED":
                raise ValueError(f"File has expired or is no longer available: {file_ref}")
        except Exception as e:
            error_msg = str(e)
            if "403" in error_msg or "404" in error_msg or "permission" in error_msg.lower() or "not found" in error_msg.lower():
                # Raise specific error for expiration so app.py can handle re-upload
                raise FileExpiredError(f"File {file_ref} has expired or is inaccessible.")
            raise ValueError(f"Cannot access file {file_ref}: {error_msg}")
        
        # Create model with system instructions for chat
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction="""You are a helpful assistant analyzing a Detailed Project Report (DPR).
When answering questions, USE CREATIVE FORMATTING to make responses easy to read:

FORMATTING RULES (Use these liberally):
1. **Bullet Points**: Use - or • for key points, lists, and features
2. **Numbered Lists**: Use 1. 2. 3. for step-by-step or priority ordering
3. **Tables**: Use | for comparisons, metrics, or structured data (example: | Feature | Value |)
4. **Bold**: Use **text** to highlight important terms
5. **Inline Code**: Use `code` for technical terms or references
6. **Sections**: Separate different topics with blank lines

CONTENT REQUIREMENTS:
- Reference specific information from the document
- Cite pages or sections using format: (page: X) or (section: Y)
- Be concise but comprehensive
- If information is not in the document, say so clearly
- Do not make up or hallucinate page numbers or facts

RESPONSE STYLE:
- Prefer visual structure (tables, lists) over paragraphs
- Use formatting to make data scannable
- Group related information together
- Always explain what the numbers or data mean
- For comparisons: use tables with clear headers"""
        )
        
        # Start chat with the document
        chat = model.start_chat(history=[])
        
        return chat, file_obj

    # Offload session creation to thread
    chat, file_obj = await asyncio.to_thread(_create_session)
    
    # Store the chat session and file reference
    _chat_sessions[dpr_id] = {
        'chat': chat,
        'file': file_obj
    }
    
    print(f"✓ Chat session created for DPR {dpr_id}")


async def send_chat_message(dpr_id: int, message: str, file_ref: str) -> Dict:
    """
    Send a message in the chat session and get a response.
    """
    print(f"⏳ Processing chat message for DPR {dpr_id}")
    start_time = time.time()
    
    # Create session if it doesn't exist
    if dpr_id not in _chat_sessions:
        await create_chat_session(dpr_id, file_ref)
    
    session = _chat_sessions[dpr_id]
    chat = session['chat']
    file_obj = session['file']
    
    # Send message with file context (blocking call offloaded)
    response = await asyncio.to_thread(chat.send_message, [file_obj, message])
    
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

def clear_chat_session(dpr_id: int) -> None:
    """Clear the in-memory chat session for a DPR."""
    if dpr_id in _chat_sessions:
        del _chat_sessions[dpr_id]
        print(f"✓ Cleared chat session for DPR {dpr_id}")


# ===== COMPARISON CHAT FUNCTIONS =====

# In-memory comparison chat sessions: {comparison_id: chat_object}
_comparison_chat_sessions = {}


async def create_comparison_chat_session(comparison_id: int, file_refs: list[str]) -> None:
    """
    Create a new comparison chat session with multiple files.
    """
    if comparison_id in _comparison_chat_sessions:
        return
    
    print(f"⏳ Creating comparison chat session for comparison {comparison_id} with {len(file_refs)} files")
    
    def _create_session():
        # Get all file objects
        file_objs = [genai.get_file(ref) for ref in file_refs]
        
        # Create detailed system instruction for comparison
        system_instruction = """You are an expert Detailed Project Report (DPR) Analyzer and Comparison Assistant.

Your role is to help users analyze and compare multiple DPR documents simultaneously. When users ask questions, you should:

1. **Cross-Document Analysis**: Compare and contrast information across all provided DPRs
2. **Identify Patterns**: Highlight common themes, differences, strengths, and weaknesses across documents
3. **Financial Comparison**: Compare financial metrics like costs, revenues, IRR, DSCR, payback periods
4. **Risk Assessment Comparison**: Compare risk profiles and mitigation strategies
5. **Recommendations**: Provide comparative insights and recommendations based on the analysis

**Response Guidelines**:
- Always specify which document(s) you're referencing (e.g., "Document 1 shows...", "Compared to Document 2...")
- Use clear comparisons: "higher/lower", "better/worse", "more/less comprehensive"
- Cite page numbers when available, format: (Doc 1, page: X)
- Be objective and data-driven in comparisons
- When asked about specific aspects, compare across ALL documents
- If information is missing from some documents, explicitly state which ones lack that information 
- Provide tabular or structured responses when comparing metrics
- Do not make up or hallucinate facts or page numbers

**Your expertise includes**:
- Financial viability analysis and comparison
- Risk assessment across multiple projects
- Timeline and implementation feasibility comparison
- Resource allocation and cost structure comparison
- Compliance and regulatory requirement comparison

Always maintain a professional, analytical tone and provide actionable insights from your comparisons."""
        
        # Create model with system instructions for comparison
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=system_instruction
        )
        
        # Start chat with all documents
        chat = model.start_chat(history=[])
        
        return chat, file_objs

    # Offload to thread
    chat, file_objs = await asyncio.to_thread(_create_session)
    
    # Store the chat session and file references
    _comparison_chat_sessions[comparison_id] = {
        'chat': chat,
        'files': file_objs
    }
    
    print(f"✓ Comparison chat session created for comparison {comparison_id}")


async def send_comparison_message(comparison_id: int, message: str, file_refs: list[str]) -> Dict:
    """
    Send a message in the comparison chat session and get a response.
    """
    print(f"⏳ Processing comparison chat message for comparison {comparison_id}")
    start_time = time.time()
    
    # Create session if it doesn't exist
    if comparison_id not in _comparison_chat_sessions:
        await create_comparison_chat_session(comparison_id, file_refs)
    
    session = _comparison_chat_sessions[comparison_id]
    chat = session['chat']
    file_objs = session['files']
    
    # Send message with all file contexts (blocking call offloaded)
    response = await asyncio.to_thread(chat.send_message, file_objs + [message])
    
    elapsed = time.time() - start_time
    print(f"✓ Comparison chat response generated in {elapsed:.2f}s (length: {len(response.text)} chars)")
    
    return {
        'reply': response.text,
        'sources': []
    }


def clear_comparison_chat_session(comparison_id: int) -> None:
    """Clear the in-memory comparison chat session."""
    if comparison_id in _comparison_chat_sessions:
        del _comparison_chat_sessions[comparison_id]
        print(f"✓ Cleared comparison chat session for comparison {comparison_id}")
