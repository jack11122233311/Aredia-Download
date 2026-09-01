import logging
import requests
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

def send_discord_webhook(webhook_url: str, title: str, status: str, details: Dict[str, Any]) -> bool:
    if not webhook_url:
        return False
    
    is_success = status.lower() == "completed"
    color = 0x10B981 if is_success else 0xEF4444  # Emerald green or Rose red
    
    fields = []
    if "duration_str" in details:
        fields.append({"name": "Duration", "value": details["duration_str"], "inline": True})
    if "filesize_str" in details:
        fields.append({"name": "Size", "value": details["filesize_str"], "inline": True})
    if "preset_name" in details:
        fields.append({"name": "Format", "value": details["preset_name"], "inline": True})
    if "uploader" in details:
        fields.append({"name": "Channel", "value": details["uploader"], "inline": True})
    if "error" in details and details["error"]:
        fields.append({"name": "Error Details", "value": str(details["error"])[:1000], "inline": False})
        
    embed = {
        "title": f"📥 Download {status.capitalize()}: {title}",
        "description": details.get("url", ""),
        "color": color,
        "fields": fields,
        "footer": {"text": "ArediaDownload — The Media Downloader"}
    }
    
    if details.get("thumbnail"):
        embed["thumbnail"] = {"url": details["thumbnail"]}
        
    payload = {
        "username": "ArediaDownload",
        "embeds": [embed]
    }
    
    try:
        resp = requests.post(webhook_url, json=payload, timeout=5)
        return resp.status_code in [200, 204]
    except Exception as e:
        logger.error(f"Failed to send Discord webhook: {e}")
        return False

def send_telegram_notification(bot_token: str, chat_id: str, title: str, status: str, details: Dict[str, Any]) -> bool:
    if not bot_token or not chat_id:
        return False
        
    icon = "✅" if status.lower() == "completed" else "❌"
    msg = f"{icon} *Download {status.capitalize()}*\n\n"
    msg += f"*Title:* {title}\n"
    if details.get("uploader"):
        msg += f"*Channel:* {details['uploader']}\n"
    if details.get("duration_str"):
        msg += f"*Duration:* {details['duration_str']}\n"
    if details.get("filesize_str"):
        msg += f"*Size:* {details['filesize_str']}\n"
    if details.get("error"):
        msg += f"*Error:* `{details['error']}`\n"
        
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": msg,
        "parse_mode": "Markdown"
    }
    
    try:
        resp = requests.post(url, json=payload, timeout=5)
        return resp.status_code == 200
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {e}")
        return False

def dispatch_notification(settings: dict, title: str, status: str, details: Dict[str, Any]):
    discord_url = settings.get("discord_webhook_url")
    if discord_url:
        send_discord_webhook(discord_url, title, status, details)
        
    tg_token = settings.get("telegram_bot_token")
    tg_chat = settings.get("telegram_chat_id")
    if tg_token and tg_chat:
        send_telegram_notification(tg_token, tg_chat, title, status, details)
