# DPR Analyzer - System Architecture

## 🏗️ Architecture Overview

The DPR Analyzer follows a clean 3-tier architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  index.html (UI) + main.js (Logic)                 │    │
│  │  - File upload interface                           │    │
│  │  - JSON visualization                              │    │
│  │  - Chat interface                                  │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND LAYER (FastAPI)                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │  app.py (Routes & Controllers)                     │    │
│  │  - POST /upload-dpr                                │    │
│  │  - GET /dpr/{id}                                   │    │
│  │  - POST /dpr/{id}/chat                             │    │
│  │  - GET /dpr/{id}/chat/history                      │    │
│  └────────────────────────────────────────────────────┘    │
│              ↕                        ↕                     │
│  ┌─────────────────────┐  ┌──────────────────────┐        │
│  │  gemini_client.py   │  │      db.py           │        │
│  │  - File upload      │  │  - SQLite ops        │        │
│  │  - JSON generation  │  │  - DPR storage       │        │
│  │  - Chat sessions    │  │  - Message storage   │        │
│  └─────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                ↕                              ↕
┌──────────────────────────┐    ┌──────────────────────────┐
│   EXTERNAL AI LAYER      │    │   DATA LAYER             │
│  Google Gemini API       │    │  SQLite Database         │
│  - Files API             │    │  - dprs table            │
│  - Generation API        │    │  - messages table        │
│  - Chat API              │    │  - PDF files             │
└──────────────────────────┘    └──────────────────────────┘
```

## 📊 Data Flow

### Upload and Analysis Flow

```
1. User selects PDF file
   ↓
2. Frontend sends multipart/form-data to POST /upload-dpr
   ↓
3. Backend saves PDF to data/ directory
   ↓
4. Backend uploads PDF to Gemini Files API
   ↓
5. Backend polls until file is processed (ACTIVE state)
   ↓
6. Backend calls Gemini with strict JSON extraction prompt
   ↓
7. Gemini analyzes PDF and returns JSON
   ↓
8. Backend validates JSON against schema.json
   ↓
9. Backend stores DPR in SQLite (with file ref and JSON)
   ↓
10. Backend returns JSON to frontend
   ↓
11. Frontend displays structured data with beautiful UI
```

### Chat Flow

```
1. User types a question
   ↓
2. Frontend sends POST /dpr/{id}/chat with message
   ↓
3. Backend creates/retrieves chat session for DPR
   ↓
4. Backend sends message + file reference to Gemini
   ↓
5. Gemini generates response with document context
   ↓
6. Backend stores both user and assistant messages in DB
   ↓
7. Backend returns assistant reply to frontend
   ↓
8. Frontend displays message in chat interface
```

## 🗃️ Database Schema

### DPRs Table
```sql
CREATE TABLE dprs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    uploaded_file_ref TEXT NOT NULL,  -- Gemini file reference
    upload_ts TEXT NOT NULL,           -- ISO timestamp
    summary_json TEXT NOT NULL         -- Serialized JSON
);
```

### Messages Table
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dpr_id INTEGER NOT NULL,           -- Foreign key to dprs
    role TEXT NOT NULL,                -- 'user' or 'assistant'
    text TEXT NOT NULL,                -- Message content
    timestamp TEXT NOT NULL,           -- ISO timestamp
    FOREIGN KEY (dpr_id) REFERENCES dprs (id)
);
```

## 🔄 Component Interactions

### app.py (Main Application)
- Initializes FastAPI application
- Mounts static files and templates
- Defines all HTTP routes
- Orchestrates calls to gemini_client and db modules
- Handles errors and HTTP responses

### gemini_client.py (AI Integration)
- Configures Google Gemini API client
- `upload_file()`: Uploads PDF to Gemini and waits for processing
- `generate_json_from_file()`: Extracts structured JSON using strict prompts
- `create_chat_session()`: Initializes chat session with document context
- `send_chat_message()`: Sends message and gets AI response
- Maintains in-memory chat sessions for performance

### db.py (Data Persistence)
- `init_db()`: Creates SQLite tables if not exist
- `insert_dpr()`: Stores DPR metadata and JSON
- `get_dpr()`: Retrieves DPR by ID
- `insert_message()`: Stores chat messages
- `get_messages()`: Retrieves chat history for a DPR

### Frontend (HTML + JavaScript)
- Single-page application with vanilla JavaScript
- No frameworks or build tools required
- Handles file upload with FormData
- Displays JSON with structured visualization
- Manages chat interface with real-time updates
- Uses fetch API for all HTTP requests

## 🔐 Security Considerations

1. **API Key Management**
   - Stored in .env file (not committed to git)
   - Loaded via python-dotenv
   - Never exposed to frontend

2. **File Upload Security**
   - Only PDF files accepted (MIME type validation)
   - Files stored with unique timestamped names
   - Stored in isolated data/ directory

3. **Input Validation**
   - JSON schema validation for Gemini outputs
   - Pydantic models for API request validation
   - SQL parameterized queries prevent injection

4. **Data Isolation**
   - Each DPR has unique ID
   - Chat sessions isolated per DPR
   - SQLite provides ACID guarantees

## ⚡ Performance Optimizations

1. **Caching Strategy**
   - In-memory chat session cache reduces API calls
   - SQLite indexed on primary keys
   - File references reused for multiple chat calls

2. **Asynchronous Operations**
   - FastAPI uses async/await where appropriate
   - File uploads processed synchronously (simplicity)
   - Future: Could add async processing queue

3. **Gemini API Efficiency**
   - Single file upload per DPR
   - File reference reused across chat messages
   - Flash model (faster, lower cost)

## 🎯 Key Design Decisions

### Why FastAPI?
- Modern, fast Python web framework
- Built-in validation with Pydantic
- Automatic OpenAPI documentation
- Excellent async support

### Why SQLite?
- Zero configuration database
- Perfect for single-server deployments
- ACID compliance
- File-based (easy backup)

### Why Gemini Flash?
- Fast processing (important for UX)
- Cost-effective
- Excellent at structured extraction
- Supports file uploads natively

### Why Vanilla JavaScript?
- No build step required
- Faster development for MVP
- Smaller bundle size
- Easier to understand and modify

### Why Synchronous Processing?
- Simpler code for hackathon/MVP
- Easier to debug
- Acceptable latency (10-30s)
- Can be made async later if needed

## 🚀 Future Enhancements

1. **Advanced Analytics**
   - Comparison across multiple DPRs
   - Trend analysis over time
   - Export to Excel/PDF reports

2. **Enhanced AI Features**
   - Multi-document chat (compare DPRs)
   - Automatic anomaly detection
   - Suggestion engine for improvements


## 📈 Scalability Considerations

### Current Limitations
- Single-server deployment
- No horizontal scaling
- In-memory chat sessions lost on restart
- SQLite limited to moderate load

## 🔧 Configuration Points

### Environment Variables
- `GEMINI_API_KEY`: AI service authentication
- `HOST`: Server binding address
- `PORT`: Server listening port

### Application Settings (Future)
- Max file size limit
- Session timeout
- Database connection pool size
- Rate limiting thresholds

### AI Model Settings
- Model name (gemini-2.5-flash)
- Temperature (creativity)
- Max tokens (response length)
- System instructions (behavior)

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

To understand the codebase better, study these in order:
1. `backend/db.py` - Simple database operations
2. `backend/schema.json` - Data structure
3. `backend/gemini_client.py` - AI integration
4. `backend/app.py` - API endpoints and orchestration
5. `backend/templates/index.html` - UI structure
6. `backend/static/main.js` - Frontend logic

Each file is well-commented and self-contained!