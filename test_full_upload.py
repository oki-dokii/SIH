import requests
import sys
import os

BASE_URL = "http://localhost:8000"

def create_test_pdf(filename="upload_test.pdf"):
    # Minimal valid PDF
    content = b"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000111 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n"
    with open(filename, "wb") as f:
        f.write(content)
    return filename

def test_upload_with_project():
    # 1. Get existing projects
    print("Fetching projects...")
    response = requests.get(f"{BASE_URL}/projects")
    if response.status_code != 200:
        print(f"Failed to get projects: {response.status_code}")
        sys.exit(1)
    
    projects = response.json()["projects"]
    if not projects:
        print("No projects available. Creating one...")
        response = requests.post(f"{BASE_URL}/projects", json={
            "name": "Upload Test Project",
            "state": "Test State",
            "scheme": "Test Scheme",
            "sector": "Test Sector"
        })
        if response.status_code != 200:
            print(f"Failed to create project: {response.text}")
            sys.exit(1)
        project_id = response.json()["id"]
        print(f"Created project with ID: {project_id}")
    else:
        project_id = projects[0]["id"]
        print(f"Using existing project ID: {project_id}")
    
    # 2. Upload file with project_id
    print(f"\nUploading file to project {project_id}...")
    pdf_file = create_test_pdf()
    
    try:
        with open(pdf_file, "rb") as f:
            files = {"file": (pdf_file, f, "application/pdf")}
            data = {"project_id": str(project_id), "language": "en"}
            response = requests.post(f"{BASE_URL}/upload-dpr", files=files, data=data)
        
        print(f"Upload response status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            dpr_id = result["id"]
            print(f"SUCCESS: DPR uploaded with ID: {dpr_id}")
            
            # 3. Verify it appears in project DPRs
            print(f"\nVerifying DPR appears in project {project_id}...")
            response = requests.get(f"{BASE_URL}/projects/{project_id}/dprs")
            if response.status_code == 200:
                dprs = response.json()["dprs"]
                found = any(dpr["id"] == dpr_id for dpr in dprs)
                if found:
                    print(f"✓ DPR {dpr_id} found in project {project_id}")
                else:
                    print(f"✗ DPR {dpr_id} NOT found in project {project_id}")
                    print(f"Project has {len(dprs)} DPRs: {[d['id'] for d in dprs]}")
            else:
                print(f"Failed to get project DPRs: {response.text}")
        else:
            print(f"Upload failed: {response.text}")
    finally:
        if os.path.exists(pdf_file):
            os.remove(pdf_file)

if __name__ == "__main__":
    try:
        test_upload_with_project()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
