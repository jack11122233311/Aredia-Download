import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.queue_manager import queue_manager
from app.routes.downloads import router as downloads_router
from app.routes.playlist import router as playlist_router
from app.routes.files import router as files_router
from app.routes.settings import router as settings_router
from app.routes.search import router as search_router

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await queue_manager.start()
    yield
    # Shutdown
    queue_manager.is_running = False

app = FastAPI(
    title="ArediaDownload API",
    description="ArediaDownload — The Media Downloader web interface and API",
    version="1.2.0",
    lifespan=lifespan
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(downloads_router)
app.include_router(playlist_router)
app.include_router(files_router)
app.include_router(settings_router)
app.include_router(search_router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "arediadownload", "version": "1.2.0"}

# Serve frontend static assets if available
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
