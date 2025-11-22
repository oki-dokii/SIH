# DPR Analyzer

## Overview

The DPR Analyzer is a multi-page web application that leverages Google Gemini AI to extract structured data from Detailed Project Report (DPR) PDFs and provide interactive chat functionality for document analysis. The application enables users to upload PDF documents, automatically extract structured JSON data matching a predefined schema, and engage in context-aware conversations about the uploaded documents. It also supports comparing multiple DPRs through dedicated comparison chat sessions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**React + TypeScript SPA**: Modern single-page application built with React 18, TypeScript, and Tailwind CSS. The frontend is served as a development server on port 5000 (Vite) which proxies API calls to the FastAPI backend on port 8000.

**Page Structure**:
- `/` - Landing page with hero section, upload zone, and feature highlights
- `/documents` - Document list with search, filtering, and statistics dashboard
- `/document/:id` - Individual document detail with analysis tabs and AI chat

**Component Architecture**:
- `src/components/` - Reusable UI components (Header, UploadZone, FeatureCard)
- `src/components/ui/` - Base UI primitives (Button, Card) with Tailwind variants
- `src/pages/` - Page components with routing logic (Index, Documents, DocumentDetail)
- `src/lib/` - Utility functions (cn for class names, api service layer)

**Design System**: Light-themed UI with:
- Primary color: Cyan blue (#0ea5e9)
- Accent color: Darker cyan (#0891b2)
- Typography: System font stack with careful hierarchy
- Tailwind CSS for utility-first styling
- Custom animations (fade-in, slide-up, scale-in, float)
- Responsive design with mobile-first approach

**State Management**: React hooks (useState, useEffect) for local component state. No global state management library needed for current scope.

**API Integration**: Custom API service (`src/lib/api.ts`) provides typed functions for:
- Fetching document lists and details
- Uploading PDFs with progress tracking
- Sending chat messages and fetching history
- Deleting documents

**Routing**: React Router v6 for client-side navigation without page reloads.

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
- React frontend source in `frontend/src/`
- Built frontend artifacts in `frontend/dist/` (production builds)
- Schema definition in `backend/schema.json`

### JavaScript Dependencies

- `react` (18.3.1) - UI library
- `react-dom` (18.3.1) - React DOM rendering
- `react-router-dom` (6.28.0) - Client-side routing
- `lucide-react` (0.468.0) - Icon library
- `tailwindcss` (3.4.17) - Utility-first CSS framework
- `vite` (5.4.21) - Build tool and dev server
- `typescript` (5.6.3) - Type safety and developer experience

## Recent Changes

**November 22, 2025 (Update 4)**: Added comprehensive PDF report generation with robust error handling
- **PDF Report Generation**: Implemented server-side PDF generation using WeasyPrint + Plotly/Kaleido
- **Professional Report Template**: Created Jinja2 HTML template with all sections:
  - Overview (project details, vision, mission, objectives, scores)
  - Financial Analysis (investment amounts, DSCR/IRR, capital structure charts)
  - Timeline (duration, milestones, operations calendar, risks)
  - Risk Assessment (severity-coded risk table)
  - Compliance Check (statutory, environmental requirements)
- **Chart Integration**: Embedded pie charts and bar charts as PNG images in the PDF
- **Robust Error Handling**: Comprehensive validation and defensive coding:
  - Validates summary_json exists before processing (HTTP 422 if missing)
  - Safe JSON parsing with try-catch (HTTP 422 on malformed data)
  - Type checking ensures dict structures throughout
  - All chart generation functions wrapped in try-except with logging
  - Graceful degradation when charts fail (logs warning, continues PDF generation)
  - Template uses conditional rendering to handle missing data sections
- **Download Functionality**: Updated download button to generate comprehensive analysis report instead of original PDF
- **System Dependencies**: Added Chromium for Kaleido chart rendering
- **Testing**: Verified with 84KB valid PDF generation, HTTP 200 responses

**November 22, 2025 (Update 3)**: Fixed "View Analysis" button navigation and enhanced chart colors
- **Navigation Fix**: Fixed "View Analysis" button on Documents page to navigate to correct route (`/documents/:id` instead of `/document/:id`)
- **Enhanced Chart Colors**: Updated chart color palette with 10 vibrant, varied colors (blue, green, orange, red, violet, pink, cyan, teal, indigo)
- **Colorful Bar Charts**: Applied color variety to all bar charts (Project Cost Breakdown and Fixed Cost Distribution)

**November 22, 2025 (Update 2)**: Enhanced Document Detail page with comprehensive analysis features
- **Three Complete Tabs**: Built Overview, Timeline, and Analysis tabs with full schema-driven data rendering
- **Interactive Charts**: Integrated Recharts library for visual data representation:
  - Pie charts for capital structure breakdown
  - Bar charts for project cost and fixed cost distribution
  - Color-coded visualizations matching brand theme
- **Download Functionality**: Added PDF download with correct file serving via `/data` static mount
- **Share Functionality**: Implemented URL sharing with clipboard API and visual feedback
- **Rich Data Display**:
  - Overview: Project details, executive summary, vision, mission, objectives, DSCR/IRR metrics
  - Timeline: Implementation duration, milestones, operations calendar, timeline risks
  - Analysis: Financial metrics, cost breakdowns, risk assessment with severity indicators, compliance checks
- **Professional UI/UX**: Color-coded cards for different data types, responsive charts, loading/error states

**November 22, 2025 (Update 1)**: Complete frontend migration and API integration
- **Frontend Redesign**: Migrated from vanilla JavaScript + Jinja2 templates to React + TypeScript + Tailwind CSS
- **Modern UI**: Implemented professional light-themed design with responsive layout and smooth animations
- **API Integration**: Created comprehensive API service layer with proper endpoint mapping:
  - Documents: `/dprs` → `{dprs: [...]}`
  - Document Detail: `/dpr/{id}` → Returns DPR with `summary_json` as parsed object
  - Chat History: `/dpr/{id}/chat/history` → `{messages: [...]}`
  - Send Message: `/dpr/{id}/chat` → `{reply, sources, message_id}`
  - Upload: `/upload-dpr` with multipart form data
- **Type Safety**: Full TypeScript interfaces for all API responses with proper data type handling
- **Vite Proxy**: Configured `/api` prefix proxy to avoid CORS issues in development
- **User Experience**: Added upload progress tracking, loading states, error handling, and optimistic UI updates
- **Dual-Server Architecture**: Vite dev server (port 5000) proxies API calls to FastAPI backend (port 8000)
- **Quality Assurance**: All three main pages (Landing, Documents, Document Detail) tested and working with real backend data