"""
Diagnostic script to test Gemini API call without internet.
This will capture the exact error type and message.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath('backend'))

import asyncio
import backend.gemini_client as gemini_client

async def test_upload():
    """Test file upload to Gemini API"""
    
    # Use an existing PDF from your data folder
    test_file = "data/20251127_221055_002f3f54_211508052028.Sample-DPR_Modernisation-expansion-of-coop-spinning-mill.pdf"
    
    if not os.path.exists(test_file):
        print(f"❌ Test file not found: {test_file}")
        print("Please update the path to an existing PDF in your data folder")
        return
    
    print(f"📤 Testing upload: {test_file}")
    print("🔴 Make sure your internet is OFF before running this!")
    print("-" * 60)
    
    try:
        file_ref = await gemini_client.upload_file(test_file)
        print(f"✅ Upload succeeded: {file_ref}")
    except Exception as e:
        print("\n🔍 ERROR DETAILS:")
        print(f"Type: {type(e).__name__}")
        print(f"Module: {type(e).__module__}")
        print(f"Message: {str(e)}")
        print(f"Message (lowercase): {str(e).lower()}")
        
        # Check if our keywords would match
        error_str = str(e).lower()
        network_keywords = [
            'connection',
            'network', 
            'timeout',
            'unreachable',
            'offline',
            'unable to find the server',
            'name resolution failed',
            'dns',
            'no internet',
            'host not found',
            'network is unreachable'
        ]
        
        matches = [kw for kw in network_keywords if kw in error_str]
        
        print(f"\n✅ Keywords that MATCH: {matches if matches else 'NONE'}")
        print(f"❌ No match? We need to add to keywords!")
        
        # Write to file for analysis
        with open("error_diagnostic.txt", "w") as f:
            f.write(f"Error Type: {type(e).__name__}\n")
            f.write(f"Error Module: {type(e).__module__}\n")
            f.write(f"Error Message: {str(e)}\n")
            f.write(f"Error Message (lowercase): {str(e).lower()}\n")
            f.write(f"\nMatching Keywords: {matches}\n")
        
        print("\n📝 Error details saved to: error_diagnostic.txt")

if __name__ == "__main__":
    print("=" * 60)
    print("GEMINI API ERROR DIAGNOSTIC TOOL")
    print("=" * 60)
    asyncio.run(test_upload())
