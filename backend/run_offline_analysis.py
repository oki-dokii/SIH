"""
Standalone script to run offline analysis.
This runs in a separate process to avoid DLL conflicts with FastAPI.
"""
import sys
import os
import json

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Add RAG to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'RAG'))

# Import from backend instead of RAG directly
backend_path = os.path.join(os.path.dirname(__file__))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from offline_analyzer import OfflineAnalyzer

def main():
    if len(sys.argv) != 4:
        print("Usage: python run_offline_analysis.py <dpr_id> <pdf_path> <output_json>")
        sys.exit(1)
    
    dpr_id = int(sys.argv[1])
    pdf_path = sys.argv[2]
    output_json = sys.argv[3]
    
    print(f"[OFFLINE] Running offline analysis for DPR {dpr_id}...")
    
    # Create analyzer
    analyzer = OfflineAnalyzer(persist_directory=os.path.join("data", "chroma_db"))
    
    # Analyze PDF
    result = analyzer.analyze_dpr(pdf_path)
    
    # Save result
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    
    print(f"[OFFLINE] Analysis complete! Saved to {output_json}")

if __name__ == "__main__":
    main()