import requests
import sys

BASE_URL = "http://localhost:8000"

def test_project_dprs():
    # Get all projects
    print("Fetching projects...")
    response = requests.get(f"{BASE_URL}/projects")
    if response.status_code != 200:
        print(f"Failed to get projects: {response.status_code}")
        sys.exit(1)
    
    projects = response.json()["projects"]
    print(f"Found {len(projects)} projects")
    
    if not projects:
        print("No projects found!")
        sys.exit(1)
    
    # Check DPRs for first project
    project = projects[0]
    project_id = project["id"]
    print(f"\nChecking DPRs for project: {project['name']} (ID: {project_id})")
    
    response = requests.get(f"{BASE_URL}/projects/{project_id}/dprs")
    if response.status_code != 200:
        print(f"Failed to get project DPRs: {response.status_code}")
        print(f"Response: {response.text}")
        sys.exit(1)
    
    dprs = response.json()["dprs"]
    print(f"Found {len(dprs)} DPRs in this project:")
    for dpr in dprs:
        print(f"  - {dpr['original_filename']} (ID: {dpr['id']})")

if __name__ == "__main__":
    try:
        test_project_dprs()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
