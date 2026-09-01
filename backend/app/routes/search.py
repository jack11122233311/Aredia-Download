import asyncio
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import yt_dlp

from app.config import COOKIES_FILE
from app.downloader import format_seconds

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])

class SearchRequest(BaseModel):
    query: str
    limit: int = Field(default=10, ge=1, le=25)

def format_views(view_count: Any) -> str:
    if view_count is None:
        return ""
    try:
        vc = float(view_count)
    except (ValueError, TypeError):
        return str(view_count)
    if vc >= 1_000_000:
        return f"{vc / 1_000_000:.1f}M views"
    elif vc >= 1_000:
        return f"{vc / 1_000:.1f}K views"
    return f"{int(vc)} views"

@router.post("")
async def search_media(req: SearchRequest):
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Search query cannot be empty")

    search_target = f"ytsearch{req.limit}:{query}"
    
    ydl_opts = {
        "extract_flat": "in_playlist",
        "skip_download": True,
        "js_runtimes": {"node": {}},
        "remote_components": ["ejs:github"],
        "quiet": True,
        "no_warnings": True,
    }
    
    if COOKIES_FILE.exists() and COOKIES_FILE.stat().st_size > 0:
        ydl_opts["cookiefile"] = str(COOKIES_FILE)

    def _execute_search():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(search_target, download=False)

    try:
        data = await asyncio.to_thread(_execute_search)
    except Exception as e:
        logger.error(f"Search failed for '{query}': {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

    entries = []
    if data and "entries" in data:
        for idx, entry in enumerate(data["entries"]):
            if not entry:
                continue
            
            entry_id = entry.get("id", "")
            url = entry.get("url") or f"https://www.youtube.com/watch?v={entry_id}"
            dur = entry.get("duration")
            views = entry.get("view_count")
            
            thumb = entry.get("thumbnail")
            if not thumb and entry.get("thumbnails"):
                thumb = entry["thumbnails"][-1].get("url")

            entries.append({
                "index": idx + 1,
                "id": entry_id,
                "title": entry.get("title", "Untitled"),
                "url": url,
                "uploader": entry.get("uploader") or entry.get("channel", "Unknown Channel"),
                "duration": dur,
                "duration_str": format_seconds(dur) if dur else "--:--",
                "view_count": views,
                "views_str": format_views(views),
                "thumbnail": thumb or ""
            })

    return {
        "query": query,
        "count": len(entries),
        "results": entries
    }
