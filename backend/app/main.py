from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from app.config import settings
from app.database import engine, Base
from app.routers import meetings, auth
from app.websocket import router as ws_router
from app.websocket.manager import manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background heartbeat monitoring task
    heartbeat_task = asyncio.create_task(manager.start_heartbeat_monitor())
    yield
    # Cleanup task on server shutdown
    heartbeat_task.cancel()
    try:
        await heartbeat_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Zoom Clone Backend REST API",
    description="Interview-ready, production-quality API backend for a Zoom-inspired Video Conferencing Platform.",
    version="1.0.0",
    lifespan=lifespan
)

# Set up CORS middleware to restrict access to trusted origins
origins = [origin.strip() for origin in settings.FRONTEND_URL.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(meetings.router)
app.include_router(ws_router.router)


@app.get("/", tags=["status"])
def read_root():
    return {
        "status": "online",
        "service": "Zoom Clone Backend REST API",
        "documentation": "/docs"
    }
