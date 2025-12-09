"""
Compliance scoring calculator for DPR analysis.
Handles recalculation of MDoNER compliance scores with custom weights.
"""
import json
from typing import Dict, Optional, List, Tuple


def get_default_weights() -> Dict[str, float]:
    """Returns the default compliance scoring weights."""
    return {
        "northEasternFocus": 0.25,
        "beneficiaryAlignment": 0.20,
        "environmentalCompliance": 0.20,
        "landAcquisition": 0.15,
        "documentationQuality": 0.10,
        "financialViability": 0.10
    }


def validate_weights(weights: Dict[str, float]) -> Tuple[bool, Optional[str]]:
    """
    Validate compliance weights.
    
    Args:
        weights: Dictionary of criterion names to weight values
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    default_keys = set(get_default_weights().keys())
    provided_keys = set(weights.keys())
    
    # Check all required keys are present
    if provided_keys != default_keys:
        missing = default_keys - provided_keys
        extra = provided_keys - default_keys
        errors = []
        if missing:
            errors.append(f"Missing keys: {missing}")
        if extra:
            errors.append(f"Extra keys: {extra}")
        return False, "; ".join(errors)
    
    # Check all values are numeric and positive
    for key, value in weights.items():
        if not isinstance(value, (int, float)):
            return False, f"Weight '{key}' must be a number, got {type(value).__name__}"
        if value < 0:
            return False, f"Weight '{key}' must be non-negative, got {value}"
    
    # Check weights sum to approximately 1.0 (allow small floating point errors)
    total = sum(weights.values())
    if abs(total - 1.0) > 0.001:
        return False, f"Weights must sum to 1.0 (100%), got {total:.4f}"
    
    return True, None


def recalculate_compliance_score(summary_json: Dict, weights: Dict[str, float]) -> Dict:
    """
    Recalculate the overall compliance score using custom weights.
    
    Args:
        summary_json: The DPR summary JSON containing mdonerComplianceScoring
        weights: Custom weights to apply
        
    Returns:
        Updated summary_json with recalculated overallComplianceScore
    """
    # Get compliance scoring section
    compliance = summary_json.get("mdonerComplianceScoring")
    if not compliance:
        print("⚠ No compliance scoring data found in summary_json")
        return summary_json
    
    breakdown = compliance.get("scoringBreakdown")
    if not breakdown:
        print("⚠ No scoring breakdown found in compliance data")
        return summary_json
    
    # Calculate new weighted score
    new_score = 0.0
    missing_criteria = []
    
    for criterion, weight in weights.items():
        criterion_data = breakdown.get(criterion)
        if criterion_data and "score" in criterion_data:
            score = criterion_data["score"]
            if score is not None:
                # Update the weight in the breakdown
                criterion_data["weight"] = weight
                # Add to weighted sum
                new_score += score * weight
            else:
                missing_criteria.append(criterion)
        else:
            missing_criteria.append(criterion)
    
    if missing_criteria:
        print(f"⚠ Missing scores for criteria: {missing_criteria}")
    
    # Update the overall compliance score
    compliance["overallComplianceScore"] = round(new_score, 2)
    
    print(f"✓ Recalculated compliance score: {new_score:.2f}/100")
    return summary_json


def recalculate_project_dprs(project_id: int, weights: Dict[str, float], db_path: str = "data/dpr.db") -> Tuple[int, List[int]]:
    """
    Recalculate compliance scores for all DPRs in a project.
    
    Args:
        project_id: The project ID
        weights: Custom weights to apply
        db_path: Path to database
        
    Returns:
        Tuple of (count_updated, list_of_failed_dpr_ids)
    """
    import sqlite3
    from datetime import datetime
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all DPRs in this project
    cursor.execute("""
        SELECT id, summary_json 
        FROM dprs 
        WHERE project_id = ? AND summary_json IS NOT NULL
    """, (project_id,))
    
    dprs = cursor.fetchall()
    count_updated = 0
    failed_ids = []
    
    print(f"⏳ Recalculating compliance scores for {len(dprs)} DPRs in project {project_id}...")
    
    for dpr in dprs:
        dpr_id = dpr["id"]
        try:
            # Parse summary JSON
            summary_json = json.loads(dpr["summary_json"])
            
            # Recalculate with new weights
            updated_summary = recalculate_compliance_score(summary_json, weights)
            
            # Save back to database
            cursor.execute("""
                UPDATE dprs 
                SET summary_json = ?
                WHERE id = ?
            """, (json.dumps(updated_summary, indent=2), dpr_id))
            
            count_updated += 1
            
        except Exception as e:
            print(f"✗ Failed to recalculate DPR {dpr_id}: {e}")
            failed_ids.append(dpr_id)
    
    conn.commit()
    conn.close()
    
    print(f"✓ Updated {count_updated} DPRs (failed: {len(failed_ids)})")
    return count_updated, failed_ids


def get_project_weights(project_id: int, db_path: str = "data/dpr.db") -> Dict[str, float]:
    """
    Get compliance weights for a project (or defaults if not set).
    
    Args:
        project_id: The project ID
        db_path: Path to database
        
    Returns:
        Dictionary of weights
    """
    import sqlite3
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT compliance_weights FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row and row["compliance_weights"]:
        try:
            return json.loads(row["compliance_weights"])
        except json.JSONDecodeError:
            print(f"⚠ Invalid compliance_weights JSON for project {project_id}, using defaults")
            return get_default_weights()
    
    return get_default_weights()


def update_project_weights(project_id: int, weights: Dict[str, float], db_path: str = "data/dpr.db") -> bool:
    """
    Update compliance weights for a project.
    
    Args:
        project_id: The project ID
        weights: New weights to set
        db_path: Path to database
        
    Returns:
        True if successful, False otherwise
    """
    import sqlite3
    
    # Validate weights first
    is_valid, error = validate_weights(weights)
    if not is_valid:
        print(f"✗ Invalid weights: {error}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE projects 
            SET compliance_weights = ?
            WHERE id = ?
        """, (json.dumps(weights), project_id))
        
        conn.commit()
        print(f"✓ Updated compliance weights for project {project_id}")
        return True
        
    except Exception as e:
        print(f"✗ Failed to update weights: {e}")
        return False
    finally:
        conn.close()
