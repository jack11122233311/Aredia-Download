import asyncio
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import yt_dlp

from app.config import COOKIES_FILE
from app.downloader import format_seconds

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/playlist", tags=["playlist"])

class PlaylistInspectRequest(BaseModel):
    url: str
    limit: int = Field(default=50, ge=1, le=200)

@router.post("/inspect")
async def inspect_playlist(req: PlaylistInspectRequest):
    if not req.url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    ydl_opts = {
        "extract_flat": "in_playlist",
        "skip_download": True,
        "playlist_items": f"1-{req.limit}",
        "js_runtimes": {"node": {}},
        "remote_components": ["ejs:github"],
        "quiet": True,
        "no_warnings": True,
    }
    if COOKIES_FILE.exists() and COOKIES_FILE.stat().st_size > 0:
        ydl_opts["cookiefile"] = str(COOKIES_FILE)

    def _extract():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(req.url.strip(), download=False)

    try:
        info = await asyncio.to_thread(_extract)
    except Exception as e:
        logger.error(f"Playlist extraction failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to inspect playlist: {str(e)}")

    if not info:
        raise HTTPException(status_code=404, detail="No playlist information found")

    is_playlist = "entries" in info
    entries = []

    if is_playlist:
        raw_entries = list(info.get("entries", []))[:req.limit]
        for idx, entry in enumerate(raw_entries):
            if not entry:
                continue
            entry_url = entry.get("url") or f"https://www.youtube.com/watch?v={entry.get('id')}"
            dur = entry.get("duration")
            
            thumb = entry.get("thumbnail")
            if not thumb and entry.get("thumbnails"):
                thumb = entry["thumbnails"][-1].get("url")

            entries.append({
                "index": idx + 1,
                "id": entry.get("id", ""),
                "title": entry.get("title", f"Track {idx + 1}"),
                "url": entry_url,
                "duration": dur,
                "duration_str": format_seconds(dur) if dur else "--",
                "uploader": entry.get("uploader") or entry.get("channel", ""),
                "thumbnail": thumb or ""
            })
    else:
        # Single video treated as a single item list
        dur = info.get("duration")
        entries.append({
            "index": 1,
            "id": info.get("id", ""),
            "title": info.get("title", "Video"),
            "url": info.get("webpage_url", req.url),
            "duration": dur,
            "duration_str": format_seconds(dur) if dur else "--",
            "uploader": info.get("uploader") or info.get("channel", ""),
            "thumbnail": info.get("thumbnail", "")
        })

    return {
        "title": info.get("title", "Playlist"),
        "uploader": info.get("uploader") or info.get("channel", ""),
        "item_count": len(entries),
        "total_available": info.get("playlist_count") or len(entries),
        "thumbnail": info.get("thumbnail", ""),
        "entries": entries
    }
