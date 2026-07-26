# Zoom-Clone-FullStack

This is an interview-ready, production-quality monorepo implementation of a Zoom-inspired Video Conferencing Platform. This codebase represents **Phase 1** of development: constructing the backend architecture and preparing the frontend structure.

## Technical Architecture

The project is structured as a clean monorepo containing:
- **Frontend Skeleton**: Built with Next.js 15, TypeScript, Tailwind CSS, and the App Router (configured, but pages not yet implemented).
- **Backend Architecture**: Built with FastAPI, SQLite, SQLAlchemy 2.0 ORM, Alembic for migrations, and Pydantic v2 schemas.

### Directory Structure

```
Zoom-Clone-FullStack/
├── frontend/             # Next.js 15 application skeleton
│   ├── app/              # Next.js App Router (layout, global styles, empty page)
│   ├── components/       # Reusable components
│   ├── hooks/            # Custom hooks
│   ├── services/         # API service layers
│   ├── lib/              # Utility libraries
│   ├── types/            # TypeScript type definitions
│   └── styles/           # Styling modules
├── backend/              # FastAPI python application
│   ├── app/
│   │   ├── routers/      # REST API endpoints (meetings.py)
│   │   ├── models/       # SQLAlchemy 2.0 models (meeting.py)
│   │   ├── schemas/      # Pydantic v2 schemas (meeting.py)
│   │   ├── services/     # Business logic layer (meeting_service.py)
│   │   ├── database.py   # SQLAlchemy configurations & session local maker
│   │   ├── config.py     # Pydantic Settings dynamic config
│   │   ├── seed.py       # DB Seeding script (5 upcoming, 5 previous meetings)
│   │   └── main.py       # FastAPI application initialiser & CORS configuration
│   ├── alembic/          # Alembic migrations directory
│   ├── alembic.ini       # Alembic migrations configuration
│   ├── requirements.txt  # Python requirements
│   ├── .env.example      # Backend environment variables template
│   └── README.md         # Backend API documentation
├── venv/                 # Python virtual environment (ignored in git)
├── README.md             # This root documentation
└── .gitignore            # Monorepo gitignore file
```

---

## Setup & Running Instructions

### Prerequisites
- Node.js (v18.x or above)
- Python (v3.10 or above)

### 1. Backend Setup
1. Open a terminal in the root directory.
2. Initialize and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell or Cmd)
   python -m venv venv
   .\venv\Scripts\activate

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Configure environment variables. Copy the template:
   ```bash
   cp backend/.env.example backend/.env
   ```
5. Apply database migrations:
   ```bash
   cd backend
   alembic upgrade head
   ```
6. Seed the SQLite database with 5 upcoming and 5 previous meetings with random guest participants:
   ```bash
   python -m app.seed
   ```
7. Start the FastAPI development server:
   ```bash
   python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   The backend API documentation will be available interactively at **`http://localhost:8000/docs`**.

### 2. Frontend Setup
1. Open a terminal in the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The frontend skeleton will run on **`http://localhost:3000`**.
