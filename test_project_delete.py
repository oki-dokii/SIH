import requests
import sys

BASE_URL = "http://localhost:8000"

def test_delete_project():
    # 1. Create a project
    print("Creating project...")
    response = requests.post(f"{BASE_URL}/projects", json={
        "name": "Test Project for Deletion",
        "state": "Test State",
        "scheme": "Test Scheme",
        "sector": "Test Sector"
    })
    if response.status_code != 200:
        print(f"Failed to create project: {response.text}")
        sys.exit(1)
    
    project_id = response.json()["id"]
    print(f"Project created with ID: {project_id}")
    
    # 2. Delete the project
    print(f"Deleting project {project_id}...")
    response = requests.delete(f"{BASE_URL}/projects/{project_id}")
    if response.status_code != 200:
        print(f"Failed to delete project: {response.text}")
        sys.exit(1)
    print("Project deleted successfully.")
    
    # 3. Verify it's gone
    print(f"Verifying project {project_id} is gone...")
    response = requests.get(f"{BASE_URL}/projects/{project_id}")
    if response.status_code == 404:
        print("Verification successful: Project not found.")
    else:
        print(f"Verification failed: Project still exists (Status: {response.status_code})")
        sys.exit(1)

if __name__ == "__main__":
    try:
        test_delete_project()
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)
