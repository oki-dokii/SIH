# DPR Analyzer - System Architecture

## 🏗️ Architecture Overview

The DPR Analyzer is a **multi-page web application** with a clean 3-tier architecture and clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐           │
│  │  home.html   │  │  list.html   │  │  detail.html    │           │
│  │  + home.js   │  │  + list.js   │  │  + detail.js    │           │
│  │              │  │              │  │                 │           │
│  │  - Upload    │  │  - List all  │  │  - Analysis     │           │
│  │  - Navigate  │  │    DPRs      │  │  - Chat         │           │
│  │              │  │  - Cards     │  │  - Clear chat   │           │
│  └──────────────┘  └──────────────┘  └─────────────────┘           │
│              │              │                 │                      │
│              └──────────────┴─────────────────┘                      │
│                  Shared: styles.css                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER (FastAPI)                           │
│  ┌────────────────────────────────────────────────────────┐         │
│  │  app.py (Routes & Controllers)                         │         │
│  │                                                         │         │
│  │  Page Routes:                    API Routes:           │         │
│  │  - GET /                         - GET /dprs           │         │
│  │  - GET /dprs/list                - POST /upload-dpr    │         │
│  │  - GET /dpr/{id}/detail          - GET /dpr/{id}       │         │
│  │                                   - POST /dpr/{id}/chat│         │
│  │                                   - GET  .../history   │         │
│  │                                   - DELETE .../chat    │         │
│  └────────────────────────────────────────────────────────┘         │
│              ↕                               ↕                       │
│  ┌──────────────────────┐       ┌───────────────────────┐          │
│  │  gemini_client.py    │       │      db.py            │          │
│  │  - File upload       │       │  - SQLite operations  │          │
│  │  - JSON generation   │       │  - DPR CRUD           │          │
│  │  - Chat sessions     │       │  - Message CRUD       │          │
│  │  - clear_chat_session│       │  - get_all_dprs       │          │
│  └──────────────────────┘       │  - get_dpr_by_filename│          │
│                                  │  - clear_chat_history │          │
│                                  └───────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                 ↕                                  ↕
┌─────────────────────────────┐    ┌──────────────────────────────┐
│   EXTERNAL AI LAYER         │    │   DATA LAYER                 │
│  Google Gemini 2.5 Flash    │    │  SQLite Database             │
│  - Files API                │    │  - dprs table                │
│  - Generation API           │    │    (with original_filename)  │
│  - Chat API (stateless)     │    │  - messages table            │
│                             │    │  - PDF files in data/        │
└─────────────────────────────┘    └──────────────────────────────┘
```

## 📊 Data Flow

### Upload and Analysis Flow (with Duplicate Detection)

```
1. User selects PDF file on home page
   ↓
2. Frontend sends multipart/form-data to POST /upload-dpr
   ↓
3. Backend extracts original filename
   ↓
4. Backend checks database for existing PDF with same name
   ├─→ If exists: Return existing analysis (skip to step 11)
   └─→ If new: Continue to step 5
   ↓
5. Backend saves PDF to data/ with timestamped unique filename
   ↓
6. Backend uploads PDF to Gemini Files API
   ↓
7. Backend polls until file is processed (ACTIVE state)
   ↓
8. Backend calls Gemini with strict JSON extraction prompt
   ↓
9. Gemini analyzes PDF and returns structured JSON
   ↓
10. Backend validates JSON against schema.json
    ↓
11. Backend stores DPR in SQLite with:
    - Timestamped filename (for storage)
    - Original filename (for duplicate detection)
    - File reference
    - Analyzed JSON
   ↓
12. Backend returns JSON + DPR ID to frontend
    ↓
13. Frontend redirects to /dpr/{id}/detail page
    ↓
14. Detail page loads and displays analysis
```

### List View Flow

```
1. User navigates to /dprs/list
   ↓
2. Frontend calls GET /dprs API endpoint
   ↓
3. Backend queries all DPRs from database (ordered by upload_ts DESC)
   ↓
4. Backend returns array of DPR objects with metadata
   ↓
5. Frontend renders DPR cards in grid layout
   ↓
6. User clicks a card
   ↓
7. Frontend navigates to /dpr/{id}/detail
```

### Chat Flow (with Persistence)

```
1. User opens detail page for a DPR
   ↓
2. Frontend automatically calls GET /dpr/{id}/chat/history
   ↓
3. Backend retrieves all messages from database for this DPR
   ↓
4. Frontend displays chat history
   ↓
5. User types a question and clicks Send
   ↓
6. Frontend sends POST /dpr/{id}/chat with message
   ↓
7. Backend stores user message in database
   ↓
8. Backend creates/retrieves Gemini chat session (in-memory)
   ↓
9. Backend sends message + file reference to Gemini
   ↓
10. Gemini generates response with document context
    ↓
11. Backend stores assistant message in database
    ↓
12. Backend returns assistant reply to frontend
    ↓
13. Frontend displays message in chat interface
```

### Clear Chat Flow

```
1. User clicks "Clear Chat" button
   ↓
2. Browser shows confirmation dialog
   ↓
3. User confirms deletion
   ↓
4. Frontend sends DELETE /dpr/{id}/chat
   ↓
5. Backend deletes all messages for this DPR from database
   ↓
6. Backend removes in-memory chat session (if exists)
   ↓
7. Backend returns success with deletion count
   ↓
8. Frontend clears chat display and shows success message
```

## 🗃️ Database Schema

### DPRs Table
```sql
CREATE TABLE dprs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,              -- e.g., "20251120_181110_abc123_report.pdf"
    original_filename TEXT NOT NULL,     -- e.g., "report.pdf" (for deduplication)
    filepath TEXT NOT NULL,              -- Full path to stored PDF
    uploaded_file_ref TEXT NOT NULL,     -- Gemini API file reference
    upload_ts TEXT NOT NULL,             -- ISO timestamp
    summary_json TEXT NOT NULL           -- Serialized JSON analysis
);

CREATE INDEX idx_original_filename ON dprs(original_filename);
```

### Messages Table
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dpr_id INTEGER NOT NULL,             -- Foreign key to dprs
    role TEXT NOT NULL,                  -- 'user' or 'assistant'
    text TEXT NOT NULL,                  -- Message content
    timestamp TEXT NOT NULL,             -- ISO timestamp
    FOREIGN KEY (dpr_id) REFERENCES dprs (id)
);
```

## 🔄 Component Interactions

### app.py (Main Application)
- Initializes FastAPI application
- Mounts static files and templates
- Defines all HTTP routes (pages + API)
- Orchestrates calls to gemini_client and db modules
- Handles errors and HTTP responses
- **New**: Serves multi-page templates
- **New**: Implements duplicate detection logic
- **New**: Clear chat endpoint

### gemini_client.py (AI Integration)
- Configures Google Gemini API client
- `upload_file()`: Uploads PDF to Gemini and waits for processing
- `generate_json_from_file()`: Extracts structured JSON using strict prompts
- `create_chat_session()`: Initializes chat session with document context
- `send_chat_message()`: Sends message and gets AI response
- **New**: `clear_chat_session()`: Removes chat session from in-memory cache
- Maintains in-memory chat sessions for performance

### db.py (Data Persistence)
- `init_db()`: Creates SQLite tables and indexes if not exist
- `insert_dpr()`: Stores DPR metadata, original filename, and JSON
- `get_dpr()`: Retrieves DPR by ID
- **New**: `get_dpr_by_filename()`: Checks if PDF exists by original filename
- **New**: `get_all_dprs()`: Retrieves all DPRs with metadata (for list page)
- `insert_message()`: Stores chat messages
- `get_messages()`: Retrieves chat history for a DPR
- **New**: `clear_chat_history()`: Deletes all messages for a specific DPR

### Frontend (Multi-Page Application)

**home.html + home.js**
- Landing page with upload and navigation
- Handles file selection and upload
- Shows duplicate detection messages
- Redirects to detail page after upload

**list.html + list.js**
- Displays all uploaded DPRs in grid
- Shows metadata: filename, date, score, recommendation
- Handles click navigation to detail page
- Empty state when no DPRs exist

**detail.html + detail.js**
- Loads DPR data by ID from URL
- Displays full analysis visualization
- Auto-loads chat history on page load
- Implements chat send/receive
- Clear chat with confirmation
- Navigation back to list and home

**styles.css**
- Shared styles for all pages
- Consistent design language
- Responsive layouts
- Reusable components

## 🔐 Security Considerations

1. **API Key Management**
   - Stored in .env file (not committed to git)
   - Loaded via python-dotenv
   - Never exposed to frontend

2. **File Upload Security**
   - Only PDF files accepted (MIME type validation)
   - Files stored with unique timestamped names
   - Stored in isolated data/ directory
   - Original filename preserved for deduplication

3. **Input Validation**
   - JSON schema validation for Gemini outputs
   - Pydantic models for API request validation
   - SQL parameterized queries prevent injection

4. **Data Isolation**
   - Each DPR has unique ID
   - Chat sessions isolated per DPR
   - SQLite provides ACID guarantees
   - Chat deletion requires DPR ID ownership

## ⚡ Performance Optimizations

1. **Caching Strategy**
   - In-memory chat session cache reduces API calls
   - SQLite indexed on `id` and `original_filename`
   - File references reused for multiple chat calls
   - Duplicate detection prevents re-processing

2. **Database Optimization**
   - Index on `original_filename` for fast lookups
   - Ordered queries by `upload_ts DESC` for list page
   - Foreign key relationships ensure data integrity

3. **Gemini API Efficiency**
   - Single file upload per unique DPR
   - File reference reused across chat messages
   - Flash model (faster, lower cost)
   - Stateless chat (history from database)

4. **Frontend Optimization**
   - Shared CSS file (cached by browser)
   - Minimal JavaScript with no frameworks
   - Auto-reload server for development

## 🎯 Key Design Decisions

### Multi-Page Architecture
**Why?**
- Clear separation of concerns (upload, list, analyze)
- Better UX with focused pages
- Easier to maintain and extend
- Allows persistent chat per DPR

### Duplicate Detection by Filename
**Why?**
- Perfect for local hackathon use
- Fast lookup with database index
- Saves API calls and processing time
- Reasonable assumption: different files have different names

### Chat History Persistence
**Why?**
- Users can resume conversations
- Better user experience
- No data loss on page refresh
- Supports multi-device access (future)

### Stateless Chat Sessions
**Why?**
- Gemini API doesn't maintain sessions
- All history loaded from database
- Simpler to implement
- Chat can be restored anytime

### SQLite Database
**Why?**
- Zero configuration
- Perfect for single-server deployments
- ACID compliance
- File-based (easy backup)
- No separate database server needed

### Vanilla JavaScript
**Why?**
- No build step required
- Faster development for hackathon
- Smaller bundle size
- Easier to understand and modify
- No framework dependencies

## 🚀 Future Enhancements

1. **Advanced Analytics**
   - Comparison across multiple DPRs
   - Trend analysis over time
   - Export to Excel/PDF reports
   - Dashboard with statistics

2. **Enhanced AI Features**
   - Multi-document chat (compare DPRs)
   - Automatic anomaly detection
   - Suggestion engine for improvements
   - Custom analysis templates

3. **User Management**
   - Authentication and authorization
   - User-specific DPR libraries
   - Role-based access control
   - Team collaboration features

4. **Scalability**
   - PostgreSQL for production
   - Redis for session caching
   - Horizontal scaling with load balancer
   - Cloud storage for PDFs (S3, GCS)

5. **UI/UX Improvements**
   -Search and filter on list page
   - Sort by score, date, name
   - Pagination for large datasets
   - Drag-and-drop file upload
   - PDF preview in browser

## 📈 Scalability Considerations

### Current Limitations
- Single-server deployment
- SQLite limited to moderate load (~100K queries/sec)
- In-memory chat sessions lost on restart
- No horizontal scaling

### Migration Path
1. **Database**: SQLite → PostgreSQL
2. **File Storage**: Local disk → Cloud storage (S3/GCS)
3. **Sessions**: In-memory → Redis
4. **API**: Single server → Load balanced cluster
5. **Frontend**: Static hosting → CDN

## 🔧 Configuration Points

### Environment Variables
```env
GEMINI_API_KEY=your_key_here  # Required - AI service authentication
HOST=127.0.0.1               # Server binding address
PORT=8000                    # Server listening port
```

### Application Settings (Future)
- Max file size limit (currently unlimited)
- Session timeout (currently no limit)
- Database connection pool size
- Rate limiting thresholds
- PDF retention policy

### AI Model Settings
- Model name: `gemini-2.5-flash`
- Temperature: Default (0.7 for chat, strict for JSON)
- Max tokens: Default
- System instructions: Defined in code

## 📝 Code Quality

### Type Safety
- Python type hints throughout
- Pydantic models for validation
- TypeScript could be added for frontend

### Error Handling
- Try-catch blocks for external calls
- HTTP error codes properly used
- User-friendly error messages
- Detailed logging for debugging

### Testing Strategy (Recommended)
- Unit tests for db.py functions
- Integration tests for API endpoints
- Mock Gemini API for testing
- Frontend E2E tests with Playwright

## 🎓 Learning Resources

To understand the codebase, study these in order:

1. **[db.py](../backend/db.py)** - Simple database operations
2. **[schema.json](../backend/schema.json)** - Data structure
3. **[gemini_client.py](../backend/gemini_client.py)** - AI integration
4. **[app.py](../backend/app.py)** - API endpoints and orchestration
5. **[styles.css](../backend/static/styles.css)** - Shared styles
6. **[home.html](../backend/templates/home.html)** - Landing page
7. **[list.html](../backend/templates/list.html)** - DPR list page
8. **[detail.html](../backend/templates/detail.html)** - Analysis page
9. **[home.js](../backend/static/home.js)** - Upload logic
10. **[list.js](../backend/static/list.js)** - List display logic
11. **[detail.js](../backend/static/detail.js)** - Analysis and chat logic

Each file is well-commented and self-contained!

## 📊 Data Flow Diagram

```
┌─────────┐      ┌──────────┐      ┌────────────┐
│  User   │─────▶│ Browser  │─────▶│  FastAPI   │
└─────────┘      └──────────┘      └────────────┘
                       │                   │
                       │                   ├─────▶ SQLite DB
                       │                   │
                       │                   └─────▶ Gemini API
                       │                           
                       ▼
              ┌────────────────┐
              │  Pages:        │
              │  - home.html   │
              │  - list.html   │
              │  - detail.html │
              └────────────────┘
```

---

**Built for hackathons. Designed for simplicity. Ready for production.**