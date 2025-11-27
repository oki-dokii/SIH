import os
import sys
# Add current directory to sys.path to ensure backend imports work
sys.path.append(os.getcwd())

from reportlab.pdfgen import canvas
from backend.offline_engine import OfflineAnalyzer

def create_dummy_pdf(filename):
    c = canvas.Canvas(filename)
    c.drawString(100, 750, "Project Report: Solar Power Plant")
    c.drawString(100, 730, "1. Executive Summary")
    c.drawString(100, 710, "This project aims to build a 50MW solar plant in Gujarat.")
    c.drawString(100, 690, "The total cost is estimated at 250 Crores.")
    c.drawString(100, 670, "Risks include land acquisition and weather delays.")
    c.save()
    print(f"Created {filename}")

def test_pipeline():
    pdf_path = os.path.abspath("test_report.pdf")
    create_dummy_pdf(pdf_path)
    
    print("Initializing OfflineAnalyzer...")
    try:
        analyzer = OfflineAnalyzer()
        
        print("Processing PDF...")
        result = analyzer.process_pdf_offline(pdf_path, dpr_id=1)
        print("Analysis Result Keys:", result.keys())
        print("Summary:", result.get('executiveSummary'))
        print("Test PASSED")
    except Exception as e:
        print("Test FAILED")
        import traceback
        traceback.print_exc()
    finally:
        if os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
            except:
                pass

if __name__ == "__main__":
    test_pipeline()
