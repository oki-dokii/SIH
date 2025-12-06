# Database Viewer - Quick Reference

## 📊 Your Database Structure

Your DPR Analyzer uses SQLite with **6 tables**:

### Tables Overview

| Table | Rows | Purpose |
|-------|------|---------|
| **projects** | 2 | Stores project information (state, scheme, sector) |
| **dprs** | 2 | Stores DPR documents with their analysis |
| **messages** | 2 | Chat messages for individual DPR conversations |
| **comparison_chats** | 2 | Comparison chat sessions |
| **comparison_chat_pdfs** | 3 | Links DPRs to comparison chats |
| **comparison_messages** | 4 | Chat messages for comparison sessions |

## 🗂️ Detailed Table Schemas

### 1. projects
Stores project metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Project name |
| `state` | TEXT | State (Arunachal Pradesh, Assam, etc.) |
| `scheme` | TEXT | Scheme (NESIDS-OTRI, PM-DevINE, etc.) |
| `sector` | TEXT | Sector (Agriculture, Health, etc.) |
| `created_at` | TEXT | ISO timestamp of creation |

**Example data:**
```json
{
  "id": 1,
  "name": "p1",
  "state": "Arunachal Pradesh",
  "scheme": "NESIDS-OTRI",
  "sector": "Agriculture and Allied",
  "created_at": "2025-11-27T09:52:49.077054"
}
```

---

### 2. dprs
Stores DPR documents and their AI analysis results.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `project_id` | INTEGER | Foreign key → projects.id |
| `filename` | TEXT | Stored filename (with timestamp) |
| `original_filename` | TEXT | Original uploaded filename |
| `filepath` | TEXT | Full file path on disk |
| `uploaded_file_ref` | TEXT | Gemini API file reference |
| `upload_ts` | TEXT | Upload timestamp |
| `summary_json` | TEXT | JSON with AI analysis results |
| `summary_json_multilang` | TEXT | Multilingual summary in JSON |

---

### 3. messages
Stores chat messages for individual DPR conversations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `dpr_id` | INTEGER | Foreign key → dprs.id |
| `role` | TEXT | "user" or "assistant" |
| `text` | TEXT | Message content |
| `timestamp` | TEXT | Message timestamp |

---

### 4. comparison_chats
Stores comparison chat sessions (for comparing multiple DPRs).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Comparison chat name |
| `created_ts` | TEXT | Creation timestamp |

---

### 5. comparison_chat_pdfs
Junction table linking DPRs to comparison chats (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `comparison_chat_id` | INTEGER | Foreign key → comparison_chats.id |
| `dpr_id` | INTEGER | Foreign key → dprs.id |

**Constraint:** UNIQUE on (comparison_chat_id, dpr_id)

---

### 6. comparison_messages
Stores chat messages for comparison sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `comparison_chat_id` | INTEGER | Foreign key → comparison_chats.id |
| `role` | TEXT | "user" or "assistant" |
| `text` | TEXT | Message content |
| `timestamp` | TEXT | Message timestamp |

---

## 🚀 Using the Database Viewer

### Export All Data
Export all tables to JSON and CSV files:

```bash
# From backend directory
python db_viewer.py --db "../data/dpr.db" --export
```

This creates a timestamped folder in `db_exports/` with:
- **JSON files**: Pretty-printed, easy to read
- **CSV files**: For Excel/spreadsheet viewing
- **summary.json**: Statistics about the export

### View Database Schema
Print detailed schema information:

```bash
python db_viewer.py --db "../data/dpr.db" --schema
```

### Interactive Query Mode
Run custom SQL queries:

```bash
python db_viewer.py --db "../data/dpr.db" --interactive
```

Example queries:
```sql
-- Get all projects with their DPR count
SELECT p.name, p.state, COUNT(d.id) as dpr_count
FROM projects p
LEFT JOIN dprs d ON p.id = d.project_id
GROUP BY p.id;

-- Get all comparison chats with message counts
SELECT c.name, COUNT(m.id) as message_count
FROM comparison_chats c
LEFT JOIN comparison_messages m ON c.id = m.comparison_chat_id
GROUP BY c.id;

-- Get all DPRs with their project info
SELECT d.original_filename, p.name as project_name, p.state
FROM dprs d
LEFT JOIN projects p ON d.project_id = p.id;
```

### All Options Combined
```bash
python db_viewer.py --db "../data/dpr.db" --export --schema --interactive
```

---

## 📁 Exported Files Location

After running the export, find your data here:

```
backend/
└── db_exports/
    └── export_YYYYMMDD_HHMMSS/
        ├── projects.json
        ├── projects.csv
        ├── dprs.json
        ├── dprs.csv
        ├── messages.json
        ├── messages.csv
        ├── comparison_chats.json
        ├── comparison_chats.csv
        ├── comparison_chat_pdfs.json
        ├── comparison_chat_pdfs.csv
        ├── comparison_messages.json
        ├── comparison_messages.csv
        └── summary.json
```

---

## 💡 Tips

- **JSON files** are easier to read for complex data structures
- **CSV files** can be opened in Excel or Google Sheets
- Use `--interactive` mode to run custom queries
- The export creates a new timestamped folder each time (doesn't overwrite)
- JSON fields in CSV are stringified for compatibility

---

## 🔗 Database Relationships

```
projects (1) ─────< dprs (many)
                     │
                     ├──< messages (many)
                     │
                     └──< comparison_chat_pdfs (many) ──> comparison_chats (1)
                                                                   │
                                                                   └──< comparison_messages (many)
```

**Relationships:**
- One project can have many DPRs
- One DPR can have many chat messages
- One DPR can be in many comparison chats (via junction table)
- One comparison chat can have many DPRs
- One comparison chat can have many comparison messages
