import os
import re
import time
import logging
from typing import Dict, Any, Callable, Optional, List
from pathlib import Path
import yt_dlp

from app.config import DOWNLOAD_DIR, COOKIES_FILE, load_settings
from app.presets import get_preset_options, PRESETS

logger = logging.getLogger(__name__)

def format_bytes(bytes_val: Any) -> str:
    if bytes_val is None:
        return "0 B"
    try:
        val = float(bytes_val)
    except (ValueError, TypeError):
        return "0 B"
    if val <= 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    unit_idx = 0
    while val >= 1024.0 and unit_idx < len(units) - 1:
        val /= 1024.0
        unit_idx += 1
    return f"{val:.1f} {units[unit_idx]}"

def format_seconds(seconds_val: Any) -> str:
    if seconds_val is None:
        return "00:00"
    try:
        val = float(seconds_val)
    except (ValueError, TypeError):
        return "00:00"
    if val <= 0:
        return "00:00"
    m, s = divmod(int(val), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"

def parse_time_to_seconds(val: Any, default: float = 0.0) -> float:
    if not val:
        return default
    val_str = str(val).strip()
    if val_str.lower() in ["inf", "infinity", "end"]:
        return float("inf")
    
    # Try yt_dlp's parse_duration
    parsed = yt_dlp.utils.parse_duration(val_str)
    if parsed is not None:
        return float(parsed)
        
    parts = val_str.split(":")
    try:
        if len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        return float(val_str)
    except Exception:
        return default

class CLIStreamLogger:
    """Intercepts yt-dlp internal logs to stream live CLI output to the frontend."""
    def __init__(self, task_id: str, on_log: Optional[Callable[[str, str], None]] = None):
        self.task_id = task_id
        self.on_log = on_log

    def debug(self, msg: str):
        if msg.startswith("[debug] "):
            self._emit("debug", msg)
        else:
            self._emit("info", msg)

    def info(self, msg: str):
        self._emit("info", msg)

    def warning(self, msg: str):
        self._emit("warning", f"[warning] {msg}")

    def error(self, msg: str):
        self._emit("error", f"[error] {msg}")

    def _emit(self, level: str, msg: str):
        clean = msg.strip()
        if clean and self.on_log:
            self.on_log(self.task_id, clean)

class DownloadWorker:
    def __init__(
        self,
        task_id: str,
        url: str,
        preset_id: str = "best_video",
        custom_args: Optional[Dict[str, Any]] = None,
        on_progress: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_log: Optional[Callable[[str, str], None]] = None
    ):
        self.task_id = task_id
        self.url = url
        self.preset_id = preset_id
        self.custom_args = custom_args or {}
        self.on_progress = on_progress
        self.on_log = on_log
        self.cancelled = False
        self.downloaded_file = None
        self.meta_info = {}

    def _progress_hook(self, d: Dict[str, Any]):
        if self.cancelled:
            raise Exception("Download cancelled by user")

        status = d.get("status")
        progress_data = {
            "task_id": self.task_id,
            "status": "downloading" if status == "downloading" else "processing",
        }

        if status == "downloading":
            try:
                downloaded = float(d.get("downloaded_bytes") or 0)
            except (ValueError, TypeError):
                downloaded = 0.0

            try:
                total = float(d.get("total_bytes") or d.get("total_bytes_estimate") or 0)
            except (ValueError, TypeError):
                total = 0.0

            percent = (downloaded / total * 100) if total > 0 else 0.0
            
            speed = d.get("speed")
            eta = d.get("eta")

            progress_data.update({
                "percent": round(percent, 1),
                "downloaded_bytes": downloaded,
                "downloaded_str": format_bytes(downloaded),
                "total_bytes": total,
                "total_str": format_bytes(total),
                "speed": speed or 0,
                "speed_str": f"{format_bytes(speed)}/s" if speed else "0 B/s",
                "eta": eta or 0,
                "eta_str": f"{eta}s" if eta else "--",
                "filename": os.path.basename(str(d.get("filename", ""))),
            })
        elif status == "finished":
            progress_data.update({
                "status": "processing",
                "percent": 100.0,
                "message": "Post-processing / Merging streams...",
                "filename": os.path.basename(d.get("filename", "")),
            })
            self.downloaded_file = d.get("filename")

        if self.on_progress:
            self.on_progress(progress_data)

    def _postprocessor_hook(self, d: Dict[str, Any]):
        if self.cancelled:
            raise Exception("Download cancelled by user")
        
        pp_name = d.get("postprocessor", "")
        if self.on_log:
            self.on_log(self.task_id, f"[ffmpeg] Postprocessor active: {pp_name}")

        if self.on_progress:
            self.on_progress({
                "task_id": self.task_id,
                "status": "processing",
                "message": f"Processing ({pp_name})...",
                "percent": 100.0
            })

    def run(self) -> Dict[str, Any]:
        settings = load_settings()
        
        # Subfolder path resolution (Addition 1)
        subfolder = str(self.custom_args.get("subfolder") or "").strip().strip("/\\")
        target_dir = DOWNLOAD_DIR / subfolder if subfolder else DOWNLOAD_DIR
        target_dir.mkdir(parents=True, exist_ok=True)
        
        out_template = str(target_dir / "%(title)s [%(id)s].%(ext)s")
        cli_logger = CLIStreamLogger(self.task_id, self.on_log)

        ydl_opts: Dict[str, Any] = {
            "outtmpl": out_template,
            "logger": cli_logger,
            "js_runtimes": {"node": {}},
            "remote_components": ["ejs:github"],
            "progress_hooks": [self._progress_hook],
            "postprocessor_hooks": [self._postprocessor_hook],
            "quiet": False,
            "no_warnings": False,
            "nocheckcertificate": False,
            "ignoreerrors": False,
            "overwrites": True,
        }

        # Handle noplaylist flag (Feature 1)
        if self.custom_args.get("noplaylist", False):
            ydl_opts["noplaylist"] = True
            if self.on_log:
                self.on_log(self.task_id, "[cli] Playlist detected: downloading single video only")

        mode = self.custom_args.get("mode", "video") # "video" or "audio"

        if mode == "audio":
            # Dedicated Audio-Only Configuration
            audio_format = self.custom_args.get("audio_format", "mp3")
            audio_bitrate = self.custom_args.get("audio_bitrate", "320")
            
            ydl_opts["format"] = "bestaudio/best"
            ydl_opts["postprocessors"] = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": audio_format,
                    "preferredquality": audio_bitrate if audio_format in ["mp3", "m4a", "opus"] else "0",
                }
            ]
        else:
            # Video Preset Configuration
            preset_opts = get_preset_options(self.preset_id)
            for k, v in preset_opts.items():
                if k == "postprocessors":
                    ydl_opts.setdefault("postprocessors", []).extend(v)
                else:
                    ydl_opts[k] = v

        # Subtitle / Closed Caption Extraction (Addition 2)
        if self.custom_args.get("embed_subtitles", False) and mode == "video":
            ydl_opts["writesubtitles"] = True
            ydl_opts["writeautomaticsub"] = True
            ydl_opts["subtitleslangs"] = ["en.*", "all"]
            ydl_opts.setdefault("postprocessors", []).append({"key": "FFmpegEmbedSubtitle"})
            if self.on_log:
                self.on_log(self.task_id, "[ffmpeg] Subtitle extraction & embedding enabled")

        # Time-Range Trimming
        start_time_raw = str(self.custom_args.get("start_time") or "").strip()
        end_time_raw = str(self.custom_args.get("end_time") or "").strip()
        if start_time_raw or end_time_raw:
            s_sec = parse_time_to_seconds(start_time_raw, default=0.0)
            e_sec = parse_time_to_seconds(end_time_raw, default=float("inf"))
            ydl_opts["download_ranges"] = yt_dlp.utils.download_range_func([], [[s_sec, e_sec]])
            ydl_opts["force_keyframes_at_cuts"] = True
            if self.on_log:
                s_disp = format_seconds(s_sec)
                e_disp = format_seconds(e_sec) if e_sec != float("inf") else "End"
                self.on_log(self.task_id, f"[cli] Time section trim active: {s_disp} ({s_sec}s) to {e_disp}")

        # Audio Loudness Normalization
        if self.custom_args.get("normalize_audio", False):
            ydl_opts.setdefault("postprocessor_args", {}).setdefault("ffmpeg", []).extend(["-af", "loudnorm"])
            if self.on_log:
                self.on_log(self.task_id, "[ffmpeg] Audio loudness normalization (EBU R128) enabled")

        # Rate Limit
        rate_limit = self.custom_args.get("rate_limit") or settings.get("default_rate_limit")
        if rate_limit:
            parsed_rate = self._parse_rate_limit(rate_limit)
            if parsed_rate:
                ydl_opts["ratelimit"] = parsed_rate

        # Cookies
        if COOKIES_FILE.exists() and COOKIES_FILE.stat().st_size > 0:
            ydl_opts["cookiefile"] = str(COOKIES_FILE)

        # SponsorBlock
        use_sponsorblock = self.custom_args.get("sponsorblock", settings.get("enable_sponsorblock", True))
        if use_sponsorblock:
            ydl_opts.setdefault("postprocessors", []).append({
                "key": "SponsorBlock",
                "categories": ["sponsor", "intro", "outro", "selfpromo", "interaction"],
                "when": "after_filter"
            })
            ydl_opts["postprocessors"].append({
                "key": "ModifyChapters",
                "remove_sponsor_segments": ["sponsor", "intro", "outro", "selfpromo", "interaction"]
            })

        # Metadata & Thumbnail Embedding
        if settings.get("embed_metadata", True):
            ydl_opts.setdefault("postprocessors", []).append({"key": "FFmpegMetadata", "add_chapters": True})
        
        if settings.get("embed_thumbnail", True):
            ydl_opts["writethumbnail"] = True
            ydl_opts.setdefault("postprocessors", []).append({"key": "EmbedThumbnail"})

        if settings.get("embed_chapters", True):
            ydl_opts["embed_chapters"] = True

        # Custom Format Override
        if self.custom_args.get("custom_format"):
            ydl_opts["format"] = self.custom_args["custom_format"]

        if self.on_log:
            self.on_log(self.task_id, f"[cli] Starting extraction for URL: {self.url}")

        # Run extraction and download
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(self.url, download=False)
            if not info:
                raise Exception("Unable to extract media information from URL")

            self.meta_info = {
                "title": info.get("title", "Unknown Title"),
                "uploader": info.get("uploader") or info.get("channel", "Unknown Channel"),
                "duration": info.get("duration", 0),
                "duration_str": format_seconds(info.get("duration", 0)),
                "thumbnail": info.get("thumbnail", ""),
                "description": info.get("description", "")[:300] if info.get("description") else "",
                "webpage_url": info.get("webpage_url", self.url),
                "subfolder": subfolder,
                "preset_id": self.preset_id if mode == "video" else f"audio_{self.custom_args.get('audio_format', 'mp3')}",
                "preset_name": PRESETS.get(self.preset_id, {}).get("name", self.preset_id) if mode == "video" else f"Audio ({self.custom_args.get('audio_format', 'mp3').upper()})",
            }

            if self.on_progress:
                self.on_progress({
                    "task_id": self.task_id,
                    "status": "starting",
                    "meta": self.meta_info,
                    "percent": 0.0
                })

            # Execute real download
            ydl.download([self.url])

        return self.meta_info

    def _parse_rate_limit(self, rate_str: Any) -> Optional[int]:
        if not rate_str:
            return None
        try:
            rate_clean = str(rate_str).strip().upper()
            if rate_clean.endswith("K"):
                return int(float(rate_clean[:-1]) * 1024)
            elif rate_clean.endswith("M"):
                return int(float(rate_clean[:-1]) * 1024 * 1024)
            elif rate_clean.endswith("G"):
                return int(float(rate_clean[:-1]) * 1024 * 1024 * 1024)
            return int(rate_clean)
        except Exception:
            return None
