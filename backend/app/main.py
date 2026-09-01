import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.queue_manager import queue_manager
from app.routes.downloads import router as downloads_router
from app.routes.playlist import router as playlist_router
from app.routes.files import router as files_router
from app.routes.settings import router as settings_router
from app.routes.search import router as search_router

logger = logging.getLogger(__name__)

def resolve_frontend_dir() -> Path:
    candidates = [
        Path("/app/frontend"),                                      # Docker container standard
        Path(__file__).resolve().parent.parent.parent / "frontend", # Local dev (ytdl/frontend)
        Path(__file__).resolve().parent.parent / "frontend",        # Flat structure
        Path("frontend").resolve(),                                 # CWD/frontend
    ]
    for c in candidates:
        if c.exists() and (c / "index.html").exists():
            return c
    return candidates[0]

FRONTEND_DIR = resolve_frontend_dir()

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
    return {
        "status": "ok",
        "service": "arediadownload",
        "version": "1.2.0",
        "frontend_mounted": FRONTEND_DIR.exists(),
        "frontend_path": str(FRONTEND_DIR)
    }

# Serve frontend static assets & SPA index.html
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

@app.get("/")
async def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {
        "status": "ok",
        "service": "arediadownload",
        "detail": "Frontend index.html not found",
        "searched_path": str(FRONTEND_DIR)
    }
