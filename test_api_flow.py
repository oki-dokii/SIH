import requests
import time
import os
import json

BASE_URL = "http://localhost:8000"
FILE_PATH = "test_upload.pdf"

def test_flow():
    # 1. Create Project
    print("Creating project...")
    project_data = {
        "name": "Chat Test Project",
        "state": "Assam",
        "scheme": "PM-DevINE",
        "sector": "Agriculture"
    }
    try:
        resp = requests.post(f"{BASE_URL}/projects", json=project_data)
        if resp.status_code != 200:
            print(f"Failed to create project: {resp.text}")
            return
        
        project = resp.json()
        project_id = project["id"]
        print(f"Project created: ID {project_id}")
    except Exception as e:
        print(f"Error creating project: {e}")
        return

    # 2. Upload DPR
    print("Uploading DPR...")
    if not os.path.exists(FILE_PATH):
        print(f"File not found: {FILE_PATH}")
        return

    try:
        with open(FILE_PATH, "rb") as f:
            files = {"file": f}
            data = {"project_id": project_id, "language": "en"}
            resp = requests.post(f"{BASE_URL}/upload-dpr", files=files, data=data)
        
        if resp.status_code != 200:
            print(f"Upload failed: {resp.text}")
            return
        
        dpr_data = resp.json()
        dpr_id = dpr_data["id"]
        print(f"DPR uploaded: ID {dpr_id}")
    except Exception as e:
        print(f"Error uploading DPR: {e}")
        return
    
    # 3. Check Project DPRs
    print("Checking project DPRs...")
    try:
        resp = requests.get(f"{BASE_URL}/projects/{project_id}/dprs")
        dprs = resp.json()["dprs"]
        found = False
        for dpr in dprs:
            if dpr["id"] == dpr_id:
                found = True
                print(f"DPR found in project: {dpr['filename']}")
                break
        
        if not found:
            print("DPR NOT found in project list!")
    except Exception as e:
        print(f"Error checking project DPRs: {e}")

    # 4. Check Analysis
    print("Checking analysis status...")
    max_retries = 30
    summary = None
    for i in range(max_retries):
        try:
            resp = requests.get(f"{BASE_URL}/dpr/{dpr_id}")
            dpr_details = resp.json()
            summary = dpr_details.get("summary_json")
            
            if summary:
                print(f"Analysis completed after {i+1} attempts!")
                break
            
            print(f"Analysis still processing... ({i+1}/{max_retries})")
            time.sleep(2)
        except Exception as e:
            print(f"Error checking analysis: {e}")
            time.sleep(2)
    
    if summary:
        print("Analysis complete!")
        # Print summary safely
        try:
            print(f"Project Name: {summary.get('projectName', 'Unknown')}")
            print(f"Overall Score: {summary.get('overallScore', 'Unknown')}")
        except Exception:
            print("Could not print summary details due to encoding.")
        
        # 5. Test Chat
        print("\nTesting Chat...")
        chat_msg = {"message": "What is the total project cost?"}
        try:
            resp = requests.post(f"{BASE_URL}/dpr/{dpr_id}/chat", json=chat_msg)
            if resp.status_code == 200:
                reply = resp.json()
                print(f"Chat Reply: {reply.get('reply')[:100]}...")
            else:
                print(f"Chat failed: {resp.text}")
        except Exception as e:
            print(f"Error testing chat: {e}")
            
    else:
        print("Analysis missing or failed.")

if __name__ == "__main__":
    test_flow()
