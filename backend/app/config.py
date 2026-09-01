import os
import json
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "/downloads" if os.path.exists("/downloads") else str(BASE_DIR.parent / "downloads")))
CONFIG_DIR = Path(os.getenv("CONFIG_DIR", "/config" if os.path.exists("/config") else str(BASE_DIR.parent / "config")))
SETTINGS_FILE = CONFIG_DIR / "settings.json"
COOKIES_FILE = CONFIG_DIR / "cookies.txt"

# Ensure runtime directories exist
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_SETTINGS = {
    "max_concurrent_downloads": int(os.getenv("MAX_CONCURRENT_DOWNLOADS", "2")),
    "default_rate_limit": os.getenv("DEFAULT_RATE_LIMIT", ""),  # e.g., "5M", "500K"
    "discord_webhook_url": os.getenv("DISCORD_WEBHOOK_URL", ""),
    "telegram_bot_token": os.getenv("TELEGRAM_BOT_TOKEN", ""),
    "telegram_chat_id": os.getenv("TELEGRAM_CHAT_ID", ""),
    "enable_sponsorblock": True,
    "embed_metadata": True,
    "embed_thumbnail": True,
    "embed_chapters": True,
}

def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                merged = {**DEFAULT_SETTINGS, **saved}
                return merged
        except Exception:
            return DEFAULT_SETTINGS.copy()
    return DEFAULT_SETTINGS.copy()

def save_settings(new_settings: dict) -> dict:
    current = load_settings()
    current.update(new_settings)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)
    return current
