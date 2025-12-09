"""
Script to add compliance weights API endpoints to app.py
This script adds the three endpoints safely without file corruption
"""

def add_endpoints():
    with open('backend/app.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # First, add the Pydantic model after CreateProjectRequest
    model_added = False
    for i, line in enumerate(lines):
        if 'class CreateProjectRequest(BaseModel):' in line:
            # Find  the end of this class (next blank line after fields)
            j = i + 1
            while j < len(lines) and (lines[j].strip() or 'sector' in lines[j]):
                j += 1
            
            # Insert the new model
            insertion_point = j + 1
            new_model = [
                '\n',
                'class UpdateComplianceWeightsRequest(BaseModel):\n',
                '    weights: dict\n',
                '    recalculate: bool = False\n',
                '\n'
            ]
            lines[insertion_point:insertion_point] = new_model
            model_added = True
            break
    
    if not model_added:
        print("Warning: Could not find CreateProjectRequest class")
        return False
    
    # Now add the three endpoints after the comparison endpoints
    endpoints_added = False
    for i, line in enumerate(lines):
        if '@app.delete("/projects/{project_id}/comparison")' in line:
            # Find the end of this function
            j = i + 1
            indent_count = 0
            while j < len(lines):
                if lines[j].strip().startswith('def ') or lines[j].strip().startswith('@app.'):
                    break
                if '{' in lines[j]:
                    indent_count += 1
                if '}' in lines[j]:
                    indent_count -= 1
                    if indent_count == 0 and '})' in lines[j]:
                        j += 1
                        break
                j += 1
            
            # Insert the new endpoints
            new_endpoints = '''

# ===== COMPLIANCE WEIGHTS API ROUTES =====

@app.get("/projects/{project_id}/compliance-weights")
async def get_compliance_weights(project_id: int):
    """
    Get compliance scoring weights for a project.
    Returns project-specific weights or defaults if not set.
    """
    import backend.compliance_calculator as compliance_calc
    
    try:
        # Verify project exists
        project = db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        # Get weights (will fall back to defaults if not set)
        weights = compliance_calc.get_project_weights(project_id)
        
        return JSONResponse({
            "success": True,
            "weights": weights,
            "isCustom": project.get("compliance_weights") is not None
        })
    except Exception as e:
        print(f"✗ Get compliance weights error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get compliance weights: {str(e)}")


@app.put("/projects/{project_id}/compliance-weights")
async def update_compliance_weights(project_id: int, request: UpdateComplianceWeightsRequest):
    """
    Update compliance scoring weights for a project.
    Optionally recalculates all DPR scores in the project with new weights.
    """
    import backend.compliance_calculator as compliance_calc
    
    try:
        # Verify project exists
        project = db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        # Validate weights
        is_valid, error_msg = compliance_calc.validate_weights(request.weights)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid weights: {error_msg}")
        
        # Update project weights
        success = compliance_calc.update_project_weights(project_id, request.weights)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update project weights")
        
        result = {
            "success": True,
            "message": "Weights updated successfully",
            "weights": request.weights
        }
        
        # Recalculate DPR scores if requested
        if request.recalculate:
            print(f"⏳ Recalculating compliance scores for project {project_id}...")
            count_updated, failed_ids = compliance_calc.recalculate_project_dprs(
                project_id, 
                request.weights
            )
            
            result["recalculated"] = True
            result["dprs_updated"] = count_updated
            result["dprs_failed"] = len(failed_ids)
            
            if failed_ids:
                result["failed_dpr_ids"] = failed_ids
                print(f"⚠ Failed to recalculate {len(failed_ids)} DPRs: {failed_ids}")
        else:
            result["recalculated"] = False
        
        return JSONResponse(result)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Update compliance weights error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update compliance weights: {str(e)}")


@app.post("/projects/{project_id}/compliance-weights/reset")
async def reset_compliance_weights(project_id: int, recalculate: bool = False):
    """
    Reset compliance weights to defaults for a project.
    Optionally recalculates all DPR scores in the project.
    """
    import backend.compliance_calculator as compliance_calc
    
    try:
        # Verify project exists
        project = db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        # Get default weights
        default_weights = compliance_calc.get_default_weights()
        
        # Update project with defaults
        success = compliance_calc.update_project_weights(project_id, default_weights)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to reset project weights")
        
        result = {
            "success": True,
            "message": "Weights reset to defaults",
            "weights": default_weights
        }
        
        # Recalculate DPR scores if requested
        if recalculate:
            print(f"⏳ Recalculating compliance scores for project {project_id} with defaults...")
            count_updated, failed_ids = compliance_calc.recalculate_project_dprs(
                project_id, 
                default_weights
            )
            
            result["recalculated"] = True
            result["dprs_updated"] = count_updated
            result["dprs_failed"] = len(failed_ids)
            
            if failed_ids:
                result["failed_dpr_ids"] = failed_ids
        else:
            result["recalculated"] = False
        
        return JSONResponse(result)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Reset compliance weights error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset compliance weights: {str(e)}")

'''
            lines.insert(j, new_endpoints)
            endpoints_added = True
            break
    
    if not endpoints_added:
        print("Warning: Could not find comparison delete endpoint")
        return False
    
    # Write back
    with open('backend/app.py', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print("✓ Successfully added compliance weights endpoints to app.py")
    return True

if __name__ == '__main__':
    add_endpoints()
