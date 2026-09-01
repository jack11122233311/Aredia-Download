import sys
import subprocess
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import yt_dlp

from app.config import COOKIES_FILE, load_settings, save_settings
from app.queue_manager import queue_manager
from app.notifications import send_discord_webhook, send_telegram_notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])

class SettingsUpdate(BaseModel):
    max_concurrent_downloads: Optional[int] = None
    default_rate_limit: Optional[str] = None
    discord_webhook_url: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    enable_sponsorblock: Optional[bool] = None
    embed_metadata: Optional[bool] = None
    embed_thumbnail: Optional[bool] = None
    embed_chapters: Optional[bool] = None

class CookiePasteRequest(BaseModel):
    content: str

class WebhookTestRequest(BaseModel):
    type: str  # "discord" or "telegram"
    webhook_url: Optional[str] = None
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None

@router.get("")
async def get_settings():
    settings = load_settings()
    has_cookies = COOKIES_FILE.exists() and COOKIES_FILE.stat().st_size > 0
    return {
        "settings": settings,
        "has_cookies": has_cookies,
        "ytdlp_version": yt_dlp.version.__version__,
        "python_version": sys.version.split()[0]
    }

@router.post("")
async def update_settings(payload: SettingsUpdate):
    data = payload.model_dump(exclude_unset=True)
    saved = save_settings(data)
    
    if "max_concurrent_downloads" in data:
        await queue_manager.update_concurrency(data["max_concurrent_downloads"])
        
    return {"status": "saved", "settings": saved}

@router.post("/cookies/upload")
async def upload_cookies_file(file: UploadFile = File(...)):
    try:
        content = await file.read()
        with open(COOKIES_FILE, "wb") as f:
            f.write(content)
        return {"status": "uploaded", "size": len(content)}
    except Exception as e:
        logger.error(f"Failed to save cookies file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save cookies: {e}")

@router.post("/cookies/paste")
async def paste_cookies(req: CookiePasteRequest):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Cookie content cannot be empty")
    try:
        with open(COOKIES_FILE, "w", encoding="utf-8") as f:
            f.write(req.content.strip())
        return {"status": "saved", "size": len(req.content)}
    except Exception as e:
        logger.error(f"Failed to write cookies: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to write cookies: {e}")

@router.delete("/cookies")
async def delete_cookies():
    if COOKIES_FILE.exists():
        COOKIES_FILE.unlink()
    return {"status": "deleted"}

@router.post("/webhooks/test")
async def test_webhook(req: WebhookTestRequest):
    test_details = {
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "uploader": "Test Channel",
        "duration_str": "03:33",
        "filesize_str": "12.4 MB",
        "preset_name": "Test Preset",
        "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    }
    
    if req.type == "discord":
        url = req.webhook_url or load_settings().get("discord_webhook_url")
        if not url:
            raise HTTPException(status_code=400, detail="Discord Webhook URL is missing")
        success = send_discord_webhook(url, "Test Notification", "completed", test_details)
        if not success:
            raise HTTPException(status_code=502, detail="Failed to deliver Discord webhook test")
        return {"status": "success", "message": "Discord test notification sent!"}
        
    elif req.type == "telegram":
        token = req.bot_token or load_settings().get("telegram_bot_token")
        chat_id = req.chat_id or load_settings().get("telegram_chat_id")
        if not token or not chat_id:
            raise HTTPException(status_code=400, detail="Telegram bot token or chat ID is missing")
        success = send_telegram_notification(token, chat_id, "Test Notification", "completed", test_details)
        if not success:
            raise HTTPException(status_code=502, detail="Failed to deliver Telegram notification")
        return {"status": "success", "message": "Telegram test notification sent!"}
        
    raise HTTPException(status_code=400, detail="Invalid webhook type")

@router.post("/system/update-ytdlp")
async def update_ytdlp():
    """In-container yt-dlp auto-updater."""
    current_ver = yt_dlp.version.__version__
    
    def _run_update():
        cmd = [sys.executable, "-m", "pip", "install", "--no-cache-dir", "--upgrade", "yt-dlp"]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return res.returncode, res.stdout, res.stderr

    try:
        code, stdout, stderr = await asyncio.to_thread(_run_update)
        if code != 0:
            return {"status": "error", "message": stderr or stdout}
            
        return {
            "status": "success",
            "previous_version": current_ver,
            "output": stdout
        }
    except Exception as e:
        logger.error(f"Failed to update yt-dlp: {e}")
        raise HTTPException(status_code=500, detail=f"Update failed: {e}")
