from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.routers import meetings

# Note: In a production system using Alembic migrations, we rely on migrations to set up the schema.
# However, to guarantee smooth immediate local run out of the box, we can keep the create_all fallback.
# Import models to ensure they are registered on the Base metadata
from app.models.meeting import Meeting, Participant

app = FastAPI(
    title="Zoom Clone Backend REST API",
    description="Interview-ready, production-quality API backend for a Zoom-inspired Video Conferencing Platform.",
    version="1.0.0"
)

# Set up CORS middleware to restrict access to trusted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(meetings.router)

@app.get("/", tags=["status"])
def read_root():
    return {
        "status": "online",
        "service": "Zoom Clone Backend REST API",
        "documentation": "/docs"
    }
