# Add this method to the OfflineAnalyzer class (after _build_section_prompt method)

def _extract_json_from_response(self, response: str) -> str:
    """
    Extract JSON from LLM response, handling markdown code blocks.
    
    Args:
        response: Raw LLM response
        
    Returns:
        Extracted JSON string
    """
    import re
    
    # Strip whitespace
    response = response.strip()
    
    # Check if response is wrapped in markdown code blocks
    # Pattern 1: ```json ... ```
    json_block_pattern = r'```json\s*(.*?)\s*```'
    match = re.search(json_block_pattern, response, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # Pattern 2: ``` ... ``` (no language specified)
    code_block_pattern = r'```\s*(.*?)\s*```'
    match = re.search(code_block_pattern, response, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # Pattern 3: Look for JSON object/array boundaries
    # Find first { or [ and last } or ]
    start_obj = response.find('{')
    start_arr = response.find('[')
    
    # Determine which comes first
    if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
        # Object comes first, find matching }
        end = response.rfind('}')
        if end != -1:
            return response[start_obj:end+1]
    elif start_arr != -1:
        # Array comes first, find matching ]
        end = response.rfind(']')
        if end != -1:
            return response[start_arr:end+1]
    
    # If no patterns matched, return original response
    return response


# Changes needed in analyze_dpr method around line 272:
#
# AFTER this line:
#     log_time(f"   LLM responded in {llm_time:.2f}s (response: {len(json_response)} chars)")
#
# ADD these lines:
#
#     # Save raw response for debugging
#     debug_file = f"llm_response_{section_name}.txt"
#     with open(debug_file, 'w', encoding='utf-8') as f:
#         f.write(f"=== RAW LLM RESPONSE FOR {section_name} ===\n\n")
#         f.write(json_response)
#         f.write(f"\n\n=== END OF RESPONSE ===\n")
#     log_time(f"📝 Raw response saved to: {debug_file}")
#
# CHANGE this line (around line 277):
#     try:
#         section_data = json.loads(json_response)
#
# TO:
#     # Try to extract JSON from response (handle markdown code blocks)
#     extracted_json = self._extract_json_from_response(json_response)
#     
#     try:
#         section_data = json.loads(extracted_json)
#
# ALSO in the retry section (around line 286), CHANGE:
#     log_time(f"⚠ JSON parse error for {section_name}: {str(e)}")
#
# TO:
#     log_time(f"⚠ JSON parse error for {section_name}: {str(e)}")
#     log_time(f"   First 200 chars: {extracted_json[:200]}")
#
# AND in retry parsing (around line 295), ADD before the try block:
#     # Save retry response
#     with open(debug_file, 'a', encoding='utf-8') as f:
#         f.write(f"\n\n=== RETRY RESPONSE ===\n\n")
#         f.write(json_response)
#         f.write(f"\n\n=== END OF RETRY ===\n")
#     
#     extracted_json = self._extract_json_from_response(json_response)
#
# CHANGE retry parsing from:
#     try:
#         section_data = json.loads(json_response)
#
# TO:
#     try:
#         section_data = json.loads(extracted_json)
#
# UPDATE the final except block (around line 304) from:
#     except:
#         section_total_time = time.time() - section_start_time
#         log_time(f"✗ Failed to parse JSON for {section_name} after retry ({section_total_time:.2f}s)")
#
# TO:
#     except Exception as parse_error:
#         section_total_time = time.time() - section_start_time
#         log_time(f"✗ Failed to parse JSON for {section_name} after retry ({section_total_time:.2f}s)")
#         log_time(f"   Parse error: {str(parse_error)}")
#         log_time(f"   Check {debug_file} for raw LLM output")
