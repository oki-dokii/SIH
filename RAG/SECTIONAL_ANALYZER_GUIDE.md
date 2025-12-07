# Sectional PDF Analyzer - Usage Guide

## Overview
This script analyzes stored PDF chunks in **5 separate sections** with targeted prompts, then merges all responses into a single JSON output for the frontend.

## How It Works

### 1. **Load Chunks from Database**
   - Uses existing chunks stored in SQLite (no reprocessing)
   - Loads all chunks for a given PDF ID

### 2. **Analyze Each Section Separately**

The script processes **5 sections** with different keyword filters and prompts:

| Section | Keywords | Purpose | Max Chunks |
|---------|----------|---------|------------|
| **Header** | project name, title, location, state, sector, scheme | Extract project metadata | 8 |
| **Overview** | executive summary, overview, introduction, objectives | Summarize project goals | 10 |
| **Risk Assessment** | risk, challenge, mitigation, threat, issue | Identify risks and mitigations | 10 |
| **Inconsistencies** | budget, cost, financial, timeline, beneficiary | Detect errors and conflicts | 12 |
| **MDoNER Compliance** | north east, tribal, environmental, compliance, clearance | Check compliance scores | 10 |

### 3. **Merge Results**
   - Combines all 5 section responses into one structured JSON
   - Follows frontend-expected schema

## Installation

```bash
# Already in requirements.txt
pip install langchain-ollama langchain-core
```

## Usage

### Basic Usage

```python
from sectional_analyzer import SectionalPDFAnalyzer

# Initialize analyzer
analyzer = SectionalPDFAnalyzer(
    db_path="data/chat.db",
    model_name="llama3.1:latest"
)

# Analyze PDF (replace with actual PDF ID)
pdf_id = 1
result = analyzer.analyze_pdf(pdf_id)

# Save to file
analyzer.save_to_file(result, f"data/analysis_{pdf_id}.json")
```

### Run from Command Line

```bash
# Run the script directly
python sectional_analyzer.py
```

**Note:** Edit line 372 to change the PDF ID:
```python
pdf_id = 1  # TODO: Replace with actual PDF ID
```

## Customizing Prompts

You can customize the prompts for each section by editing the `sections` dictionary in the `analyze_pdf()` method (starting at line 124):

```python
sections = {
    "header": {
        "keywords": ["project name", "title", ...],
        "max_chunks": 8,
        "query": """YOUR CUSTOM QUERY HERE""",
        "system_prompt": "YOUR CUSTOM SYSTEM PROMPT HERE"
    },
    # ... other sections
}
```

### Example: Customizing the Overview Section

```python
"overview": {
    "keywords": ["executive summary", "overview", "introduction"],
    "max_chunks": 10,
    "query": """Extract detailed project overview:
- Executive summary (2-3 paragraphs)
- Main objectives (numbered list)
- Expected outcomes
- Target beneficiaries
Return as JSON with keys: executiveSummary, objectives, outcomes, beneficiaries""",
    "system_prompt": "You are an expert at summarizing DPR documents with focus on clarity and completeness."
}
```

## Output Format

The final JSON structure:

```json
{
  "projectName": "...",
  "projectLocation": {...},
  "projectSector": "...",
  "schemeName": "...",
  "executiveSummary": "...",
  "scopeAndObjectives": {...},
  "riskAssessment": [...],
  "inconsistencyDetection": {
    "hasInconsistencies": true/false,
    "totalInconsistencies": 0,
    "issues": [...]
  },
  "mdonerComplianceScoring": {
    "scores": {...},
    "overallComplianceScore": 0,
    "complianceGaps": [...],
    "complianceStrengths": [...]
  },
  "analysisMetadata": {
    "sectionalAnalysis": true,
    "sectionsAnalyzed": ["header", "overview", ...],
    "timestamp": "2025-12-07T01:30:00"
  }
}
```

## Key Features

✅ **Keyword-Based Filtering** - Each section only gets relevant chunks
✅ **Separate LLM Calls** - Faster response times
✅ **Customizable Prompts** - Easy to modify for your needs  
✅ **JSON Output** - Ready for frontend consumption
✅ **Error Handling** - Graceful handling of JSON parsing errors
✅ **Progress Logging** - Detailed console output

## Tips

1. **Adjust `max_chunks`** per section based on your needs (fewer = faster)
2. **Add more keywords** to improve chunk filtering accuracy
3. **Modify `temperature`** in `__init__` for more/less creative responses
4. **Check console logs** to see which chunks are being selected
