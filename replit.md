# DPR Analyzer

## Overview

The DPR Analyzer is a multi-page web application that leverages Google Gemini AI to extract structured data from Detailed Project Report (DPR) PDFs and provide interactive chat functionality for document analysis. The application enables users to upload PDF documents, automatically extract structured JSON data matching a predefined schema, and engage in context-aware conversations about the uploaded documents. It also supports comparing multiple DPRs through dedicated comparison chat sessions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Multi-Page Application Pattern**: The application uses a traditional multi-page architecture with separate HTML pages for distinct user flows:
- `home.html` - Landing page with upload functionality and navigation
- `list.html` - Grid view of all uploaded DPRs with comparison mode
- `detail.html` - Individual DPR analysis with chat interface
- `comparison.html` - Multi-DPR comparison with dedicated chat
- `comparisons.html` - Management page for comparison sessions

**Shared Styling**: All pages utilize a unified `styles.css` with a dark theme, gradient backgrounds, and responsive design principles. The design system uses consistent color palette (#00d4ff accents, dark backgrounds) and reusable component classes.

**Page-Specific JavaScript**: Each HTML page has a corresponding JavaScript file that handles:
- Dynamic content loading via REST API calls
- Real-time UI updates (loading states, error handling)
- Interactive features (file selection, chat messaging)
- Navigation flow between pages

**State Management**: Simple client-side state management using JavaScript variables and DOM manipulation. No frontend framework dependencies.

### Backend Architecture

**FastAPI Framework**: The backend uses FastAPI as the web framework, providing:
- Fast async request handling
- Automatic API documentation
- Built-in request validation with Pydantic models
- Template rendering with Jinja2

**Route Organization**: Routes are organized into two categories:
1. **Page Routes** - Return HTML templates (/, /dprs/list, /dpr/{id}/detail, /comparison-chat/{id}, /comparisons)
2. **API Routes** - Return JSON responses (/dprs, /upload-dpr, /dpr/{id}, /dpr/{id}/chat, /comparison-chats, etc.)

**Service Layer Pattern**: Business logic is separated into dedicated modules:
- `gemini_client.py` - AI integration and chat session management
- `db.py` - Database operations and queries

**File Upload Handling**: PDF files are uploaded to a `data/` directory with UUID-based filenames to prevent conflicts. The original filename is preserved in the database for display purposes.

**Schema-Driven Extraction**: Uses a predefined JSON schema (`schema.json`) to guide AI extraction of structured data from PDFs. The schema defines expected fields for financial analysis, timeline analysis, scope, objectives, and other DPR components.

### Data Storage

**SQLite Database**: Lightweight relational database with three main tables:

1. **dprs table** - Stores uploaded DPR documents
   - Fields: id, filename, original_filename, filepath, uploaded_file_ref, upload_ts, summary_json
   - Index on original_filename for duplicate detection

2. **messages table** - Stores chat history per DPR
   - Fields: id, dpr_id, role (user/assistant), text, timestamp
   - Foreign key relationship to dprs table

3. **comparison_chats table** - Stores comparison session metadata
   - Fields: id, name, created_ts
   - Additional tables track DPR-comparison relationships

**JSON Storage**: Extracted DPR analysis is stored as JSON text in the summary_json column, allowing flexible schema evolution without database migrations.

**Duplicate Prevention**: Before processing uploads, the system checks if a file with the same original_filename already exists to avoid redundant AI processing.

### AI Integration

**Google Gemini 2.5 Flash**: Primary AI model for document analysis and chat interactions. Chosen for:
- Fast response times suitable for interactive chat
- Strong document understanding capabilities
- Support for large context windows
- File upload API for processing PDFs

**Two-Phase AI Workflow**:
1. **Upload & Extract** - PDF uploaded to Gemini Files API, then processed with schema-guided prompt to extract structured JSON
2. **Interactive Chat** - In-memory chat sessions maintain conversation context using uploaded file reference

**Chat Session Management**: In-memory dictionary (`_chat_sessions`) stores active chat objects keyed by DPR ID. Sessions persist for the lifetime of the backend process, enabling multi-turn conversations without re-uploading files.

**Comparison Chat**: Separate chat flow that references multiple DPR documents simultaneously, allowing cross-document analysis and comparison queries.

### Authentication & Authorization

**No Authentication**: The current architecture does not implement user authentication or authorization. The application assumes a single-user or trusted environment deployment model.

## External Dependencies

### Third-Party Services

**Google Gemini API**: Core dependency for all AI functionality
- API Key required via `GEMINI_API_KEY` environment variable
- Files API for PDF upload and processing
- Generative API for chat completions
- Rate limits and quotas apply per Google's terms

### Python Packages

- `fastapi` (0.104.1) - Web framework
- `uvicorn` (0.24.0) - ASGI server for running FastAPI
- `google-generativeai` (>=0.8.0) - Official Google Gemini SDK
- `python-dotenv` (1.0.0) - Environment variable management
- `python-multipart` (0.0.6) - File upload handling
- `jinja2` (3.1.2) - HTML template rendering

### Database

**SQLite**: Embedded database, no external server required. Database file stored at `data/dpr.db`.

### File System Dependencies

- Local file storage in `data/` directory for uploaded PDFs
- Static file serving from `backend/static/`
- Template files in `backend/templates/`
- Schema definition in `backend/schema.json`