import os
import mimetypes
import logging
from pathlib import Path
from typing import Optional
from urllib.parse import unquote
from fastapi import APIRouter, HTTPException, Header, Response, status
from fastapi.responses import FileResponse, StreamingResponse

from app.config import DOWNLOAD_DIR
from app.downloader import format_bytes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/files", tags=["files"])

def get_media_type(filepath: Path) -> str:
    ext = filepath.suffix.lower()
    if ext in [".mp4", ".mkv", ".webm", ".mov", ".avi"]:
        return "video"
    elif ext in [".mp3", ".m4a", ".flac", ".wav", ".opus", ".aac", ".ogg"]:
        return "audio"
    elif ext in [".srt", ".vtt", ".ass"]:
        return "subtitle"
    return "other"

def resolve_safe_path(rel_path: str) -> Path:
    # URL decode path and strip leading slashes
    clean_rel = unquote(rel_path).lstrip("/\\")
    base = DOWNLOAD_DIR.resolve()
    target = (DOWNLOAD_DIR / clean_rel).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        logger.warning(f"Path traversal blocked for: {rel_path}")
        raise HTTPException(status_code=403, detail="Access denied: path outside downloads directory")
    return target

@router.get("")
async def list_downloaded_files():
    if not DOWNLOAD_DIR.exists():
        return []

    files = []
    for item in DOWNLOAD_DIR.rglob("*"):
        if item.is_file() and not item.name.endswith(".part") and not item.name.endswith(".ytdl"):
            try:
                stat = item.stat()
                rel_name = str(item.relative_to(DOWNLOAD_DIR)).replace("\\", "/")
                sub = str(item.parent.relative_to(DOWNLOAD_DIR)).replace("\\", "/") if item.parent != DOWNLOAD_DIR else ""
                files.append({
                    "name": item.name,
                    "relative_path": rel_name,
                    "subfolder": sub,
                    "size": stat.st_size,
                    "size_str": format_bytes(stat.st_size),
                    "modified": stat.st_mtime,
                    "extension": item.suffix.lstrip(".").lower(),
                    "media_type": get_media_type(item)
                })
            except Exception as e:
                logger.error(f"Error reading metadata for {item}: {e}")

    # Sort newest first
    files.sort(key=lambda x: x["modified"], reverse=True)
    return files

@router.delete("/{rel_path:path}")
async def delete_file(rel_path: str):
    target = resolve_safe_path(rel_path)
    
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    try:
        try:
            target.unlink()
        except PermissionError:
            # Attempt to modify permissions and retry
            os.chmod(target, 0o666)
            target.unlink()
        return {"status": "deleted", "filename": target.name}
    except Exception as e:
        logger.error(f"Failed to delete file {target.name}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete file: {str(e)}. Check container volume write permissions."
        )

@router.get("/download/{rel_path:path}")
async def download_file(rel_path: str):
    target = resolve_safe_path(rel_path)

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(target),
        filename=target.name,
        media_type="application/octet-stream"
    )

@router.get("/stream/{rel_path:path}")
async def stream_media(rel_path: str, range: Optional[str] = Header(None)):
    """Streaming endpoint with HTTP Range Request support for HTML5 video/audio seeking."""
    target = resolve_safe_path(rel_path)

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    file_size = target.stat().st_size
    mime_type, _ = mimetypes.guess_type(str(target))
    if not mime_type:
        mime_type = "video/mp4" if get_media_type(target) == "video" else "audio/mpeg"

    if not range:
        return FileResponse(path=str(target), media_type=mime_type)

    try:
        range_val = range.replace("bytes=", "").split("-")
        start = int(range_val[0]) if range_val[0] else 0
        end = int(range_val[1]) if len(range_val) > 1 and range_val[1] else file_size - 1
        end = min(end, file_size - 1)
        content_length = (end - start) + 1

        def iter_file():
            with open(target, "rb") as f:
                f.seek(start)
                bytes_left = content_length
                chunk_size = 1024 * 1024  # 1MB
                while bytes_left > 0:
                    read_size = min(chunk_size, bytes_left)
                    data = f.read(read_size)
                    if not data:
                        break
                    bytes_left -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": mime_type,
        }
        return StreamingResponse(iter_file(), status_code=status.HTTP_206_PARTIAL_CONTENT, headers=headers)
    except Exception as e:
        logger.error(f"Streaming error for {target.name}: {e}")
        return FileResponse(path=str(target), media_type=mime_type)
