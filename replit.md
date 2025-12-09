# FEATURE/SIH-UPDATE BRANCH CHANGE - This line was added in feature/sih-update branch

# DPR Analyzer

## Overview

The DPR Analyzer is a multi-page web application that uses Google Gemini AI to extract structured data from Detailed Project Report (DPR) PDFs. It allows users to upload PDFs, automatically extract JSON data, and engage in interactive, context-aware conversations about the documents. The application also supports comparing multiple DPRs through dedicated comparison chat sessions, aiming to provide comprehensive document analysis and comparison capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is a React 18 SPA with TypeScript and Tailwind CSS, served by Vite. It features a responsive, light-themed UI with a primary cyan blue color scheme and custom animations. Key pages include a landing page, a documents list with search and statistics, and a document detail page with analysis tabs and AI chat. State management uses React hooks, and API integration is handled by a custom service layer using React Router v6 for navigation.

### Backend Architecture

The backend uses FastAPI for fast, async request handling, automatic API documentation, and Pydantic validation. Routes are divided into page routes (returning HTML templates) and API routes (returning JSON). Business logic is organized using a service layer pattern, with `gemini_client.py` for AI integration and `db.py` for database operations. PDF files are uploaded and stored locally with UUID-based filenames. Schema-driven extraction uses `schema.json` to guide AI in extracting structured data into predefined fields.

### Data Storage

A lightweight SQLite database stores DPR documents, chat messages, and comparison session metadata. The `dprs` table holds document details, `messages` stores chat history, and `comparison_chats` manages comparison sessions. Extracted DPR analysis is stored as JSON text within the `summary_json` column for flexible schema evolution. Duplicate document uploads are prevented by checking existing filenames.

### AI Integration

Google Gemini 2.5 Flash is the primary AI model for document analysis and chat, chosen for its speed, document understanding, large context windows, and PDF processing capabilities. The AI workflow involves a two-phase process: initial upload and structured data extraction, followed by interactive chat using the uploaded file reference. Chat sessions are managed in-memory, and a separate comparison chat flow allows cross-document analysis.

### Multi-Language Support

The application features a comprehensive multi-language system that generates AI analysis in multiple languages at upload time:

- **Upload-time generation**: When a PDF is uploaded, the AI generates complete analysis in ALL supported languages (currently English and Hindi)
- **Instant language switching**: Users can toggle between languages without re-processing; the pre-generated content is retrieved from the database
- **Scalable architecture**: New languages can be added by simply updating the `supported_languages` array in `backend/app.py`
- **Storage**: Multi-language JSON stored in `summary_json_multilang` column as `{"en": {...}, "hi": {...}, ...}`
- **Frontend integration**: Language toggle triggers document re-fetch with language parameter; UI translations handled by `i18n.ts`

**Supported Languages**: English (en), Hindi (hi)
**Future Languages**: Can easily add Assamese, Bengali, and other regional languages by updating configuration

### Authentication & Authorization

The application currently does not implement user authentication or authorization, assuming a single-user or trusted environment.

## External Dependencies

### Third-Party Services

- **Google Gemini API**: Essential for all AI functionalities (API Key via `GEMINI_API_KEY` env var, Files API, Generative API).

### Python Packages

- `fastapi`
- `uvicorn`
- `google-generativeai`
- `python-dotenv`
- `python-multipart`
- `jinja2`

### Database

- **SQLite**: Embedded database, `data/dpr.db`.

### File System Dependencies

- `data/` for uploaded PDFs.
- `frontend/src/` for React frontend source.
- `backend/schema.json` for schema definition.

### JavaScript Dependencies

- `react`
- `react-dom`
- `react-router-dom`
- `lucide-react`
- `tailwindcss`
- `vite`
- `typescript`