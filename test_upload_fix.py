import requests
import sys
import os

BASE_URL = "http://localhost:8000"

def create_dummy_pdf(filename="test_fix.pdf"):
    # Minimal valid PDF content
    content = b"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000111 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n"
    with open(filename, "wb") as f:
        f.write(content)
    return filename

def test_upload_fix():
    # 1. Create a project
    print("Creating project...")
    response = requests.post(f"{BASE_URL}/projects", json={
        "name": "Upload Fix Test Project",
        "state": "Test State",
        "scheme": "Test Scheme",
        "sector": "Test Sector"
    })
    if response.status_code != 200:
        print(f"Failed to create project: {response.text}")
        sys.exit(1)
    
    project_id = response.json()["id"]
    print(f"Project created with ID: {project_id}")
    
    # 2. Upload DPR to the project
    print(f"Uploading DPR to project {project_id}...")
    pdf_filename = create_dummy_pdf()
    
    try:
        with open(pdf_filename, "rb") as f:
            files = {"file": (pdf_filename, f, "application/pdf")}
            data = {"project_id": project_id, "language": "en"}
            response = requests.post(f"{BASE_URL}/upload-dpr", files=files, data=data)
        
        if response.status_code == 200:
            dpr_data = response.json()
            print(f"SUCCESS: DPR uploaded with ID: {dpr_data['id']}")
        else:
            print(f"FAILED: Upload failed with status {response.status_code}")
            print(f"Response: {response.text}")
            sys.exit(1)
            
    finally:
        if os.path.exists(pdf_filename):
            os.remove(pdf_filename)

if __name__ == "__main__":
    try:
        test_upload_fix()
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)
