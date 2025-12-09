# DPR Analyzer - AI-Powered Document Analysis System

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A comprehensive web-based platform for analyzing Detailed Project Reports (DPRs) using Google's Gemini AI. Built for the Ministry of Development of North Eastern Region (MDoNER), this system automates DPR evaluation, compliance checking, and project comparison with sector-specific validation.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Capabilities
- **AI-Powered Analysis**: Automated DPR analysis using Google Gemini 2.0 Flash
- **Multi-Language Support**: Full i18n support for English, Hindi, and regional languages
- **Sector-Specific Compliance**: Customized compliance criteria for different project sectors
  - Roads and Bridges: 12-category infrastructure-focused scoring
  - Other Sectors: 6-category general compliance scoring
- **Interactive Chat**: AI assistant for project-specific queries with context-aware responses
- **Comparative Analysis**: Multi-DPR comparison with AI-generated recommendations
- **PDF Generation**: Automated report generation with charts and visualizations

### Advanced Features
- **State/Sector Validation**: Automatic flagging of location and sector mismatches
- **Enum Constraints**: Strict validation against 14 MDoNER sectors and 8 NE states
- **Financial Analysis**: Detailed cost breakdowns, ROI calculations, DSCR/IRR metrics
- **Risk Assessment**: Multi-dimensional risk evaluation with severity classifications
- **Environmental Impact**: Compliance tracking for clearances and sensitive zones
- **Inconsistency Detection**: Automated identification of data conflicts in DPRs

### User Management
- **Role-Based Access**: Separate admin and client interfaces
- **Secure Authentication**: Password hashing with bcrypt
- **Project Organization**: Hierarchical project-DPR management
- **Status Tracking**: Real-time analysis status and feedback system

---

## 🏗️ Architecture

### Technology Stack

**Backend:**
- **Framework**: FastAPI (Python 3.9+)
- **Database**: SQLite with async operations
- **AI Engine**: Google Gemini 2.0 Flash
- **PDF Processing**: Gemini File API, WeasyPrint
- **Visualization**: Plotly, Kaleido

**Frontend:**
- **Framework**: React 18.2 with TypeScript
- **Build Tool**: Vite 5.0
- **Styling**: TailwindCSS 3.3
- **UI Components**: Lucide React icons, custom components
- **Charts**: Recharts 3.4
- **PDF Viewer**: React-PDF 7.7
- **Maps**: React-Leaflet 5.0

### System Design

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │ ◄─────► │   FastAPI    │ ◄─────► │   Gemini    │
│  (React)    │  REST   │   Backend    │   API   │     AI      │
└─────────────┘         └──────────────┘         └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   SQLite     │
                        │   Database   │
                        └──────────────┘
```

---

## 📦 Prerequisites

### System Requirements
- **Python**: 3.9 or higher
- **Node.js**: 16.0 or higher
- **npm**: 7.0 or higher
- **Memory**: 4GB RAM minimum
- **Storage**: 500MB for dependencies + space for uploaded files

### API Keys
- **Google Gemini API Key**: Required for AI analysis
  - Get your free API key: https://ai.google.dev/

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/aangir14/SIH-first.git
cd SIH-first
```

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Create necessary directories
mkdir -p data templates/reports

# Initialize database
python -c "import backend.db as db; db.init_db()"
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Return to root
cd ..
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Required: Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_API_KEY=your_gemini_api_key_here

# Optional: Server Configuration
HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_PORT=5000

# Optional: Database
DATABASE_PATH=data/dpr.db

# Optional: Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

### First-Time Setup

```bash
# Set up admin credentials
python update_app_auth.py

# Verify database initialization
sqlite3 data/dpr.db ".schema"
```

---

## 💻 Usage

### Development Mode

**Start Backend Server:**
```bash
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

**Start Frontend Development Server:**
```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5000
```

**Access the Application:**
- Frontend: http://127.0.0.1:5000
- Backend API: http://127.0.0.1:8000
- API Documentation: http://127.0.0.1:8000/docs

### Production Mode

```bash
# Build frontend
cd frontend
npm run build
cd ..

# Start production server
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 📚 API Documentation

### Authentication Endpoints

**Admin Login**
```http
POST /api/admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

**Client Login**
```http
POST /api/user/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

### Project Management

**Create Project**
```http
POST /projects
Content-Type: application/json

{
  "name": "Highway Construction Project",
  "state": "Assam",
  "sector": "Roads and Bridges"
}
```

**Get Projects**
```http
GET /projects
```

**Get Project Details**
```http
GET /projects/{project_id}
```

### DPR Management

**Upload DPR (Client)**
```http
POST /api/client/dprs/upload?client_id=1
Content-Type: multipart/form-data

file: <PDF file>
project_id: 1
```

**Analyze DPR**
```http
POST /dprs/{dpr_id}/analyze
```

**Get DPR Analysis**
```http
GET /dpr/{dpr_id}
```

**Compare DPRs**
```http
POST /projects/{project_id}/compare-all
```

### Chat Endpoints

**Send Chat Message**
```http
POST /dpr/{dpr_id}/chat
Content-Type: application/json

{
  "message": "What is the total project cost?"
}
```

**Get Chat History**
```http
GET /dpr/{dpr_id}/chat/history
```

---

## 📁 Project Structure

```
sih-login/
├── backend/
│   ├── __init__.py
│   ├── app.py                    # FastAPI application
│   ├── db.py                     # Database operations
│   ├── gemini_client.py          # Gemini AI integration
│   ├── report_generator.py       # PDF report generation
│   ├── compliance_calculator.py  # Compliance scoring
│   ├── translation_service.py    # i18n support
│   ├── schema.json              # DPR analysis schema
│   └── templates/
│       └── reports/
│           └── dpr_report.html  # Report template
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── contexts/            # React contexts
│   │   ├── lib/                 # Utilities
│   │   ├── pages/               # Page components
│   │   ├── App.tsx              # Main app component
│   │   └── main.tsx             # Entry point
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── data/
│   └── dpr.db                   # SQLite database
├── .env                         # Environment variables
├── requirements.txt             # Python dependencies
├── README.md                    # This file
└── start.sh                     # Startup script
```

---

## 🌐 Deployment

### Docker Deployment (Recommended)

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build frontend
RUN cd frontend && npm install && npm run build

EXPOSE 8000
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Cloud Deployment

**Supported Platforms:**
- AWS EC2 / Elastic Beanstalk
- Google Cloud Run / Compute Engine
- Azure App Service
- Railway / Render / Fly.io

**Environment Configuration:**
1. Set `GEMINI_API_KEY` as environment variable
2. Configure database persistence
3. Set up file storage for uploaded PDFs
4. Enable HTTPS

---

## 🔧 Troubleshooting

### Common Issues

**Issue**: Gemini API quota exceeded
```
Solution: Wait for quota reset or upgrade to paid tier
Check usage: https://ai.dev/usage?tab=rate-limit
```

**Issue**: Database locked errors
```bash
# Reset database
rm data/dpr.db
python -c "import backend.db as db; db.init_db()"
```

**Issue**: Frontend build fails
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style
- **Python**: Follow PEP 8
- **TypeScript**: Use ESLint configuration
- **Commits**: Use conventional commits format

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Kabir Ahuja** - Initial work - [aangir14](https://github.com/aangir14)

---

## 🙏 Acknowledgments

- Ministry of Development of North Eastern Region (MDoNER) for requirements
- Google Gemini team for AI capabilities
- FastAPI and React communities for excellent frameworks
- All contributors and testers

---

## 📞 Support

For support and queries:
- **Issues**: https://github.com/aangir14/SIH-first/issues
- **Email**: support@dpranalyzer.com

---

**Built with ❤️ for Smart India Hackathon 2024**
