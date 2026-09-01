from typing import Dict, Any

PRESETS: Dict[str, Dict[str, Any]] = {
    "best_video": {
        "id": "best_video",
        "name": "Best Quality Video",
        "badge": "Auto Best",
        "tag": "video",
        "description": "Highest resolution video + best audio automatically merged (MP4/MKV)",
        "ydl_opts": {
            "format": "bestvideo+bestaudio/best",
            "merge_output_format": "mp4",
        }
    },
    "video_4k": {
        "id": "video_4k",
        "name": "4K Ultra HD (2160p+)",
        "badge": "4K / 2K",
        "tag": "video",
        "description": "Prefers 4K/1440p ultra-high resolution streams with high bitrate",
        "ydl_opts": {
            "format": "bestvideo[height>=1440]+bestaudio/bestvideo+bestaudio/best",
            "merge_output_format": "mp4",
        }
    },
    "video_1080p": {
        "id": "video_1080p",
        "name": "1080p Full HD",
        "badge": "1080p MP4",
        "tag": "video",
        "description": "Standard 1080p video, compatible with almost all media players",
        "ydl_opts": {
            "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
            "merge_output_format": "mp4",
        }
    },
    "video_720p": {
        "id": "video_720p",
        "name": "720p HD (Fast)",
        "badge": "720p MP4",
        "tag": "video",
        "description": "Quick download, smaller file size, great for mobile viewing",
        "ydl_opts": {
            "format": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
            "merge_output_format": "mp4",
        }
    },
    "discord_share": {
        "id": "discord_share",
        "name": "Discord & Chat Share",
        "badge": "< 25MB",
        "tag": "video",
        "description": "Optimized file size cap for sharing directly in Discord, Slack, or Telegram",
        "ydl_opts": {
            "format": "bestvideo[filesize<25M]+bestaudio[filesize<10M]/best[filesize<25M]/bestvideo[height<=720]+bestaudio/best[height<=720]/best",
            "merge_output_format": "mp4",
        }
    },
    "apple_ios": {
        "id": "apple_ios",
        "name": "Apple & iOS Universal",
        "badge": "H.264 / AAC",
        "tag": "video",
        "description": "Strict H.264 video & AAC audio for iPhone, iPad, Apple TV, and QuickTime",
        "ydl_opts": {
            "format": "bestvideo[vcodec^=avc1][height<=1080]+bestaudio[acodec^=mp4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "merge_output_format": "mp4",
        }
    },
    "archival_master": {
        "id": "archival_master",
        "name": "Archival Master (MKV)",
        "badge": "Untouched MKV",
        "tag": "video",
        "description": "Raw, untouched highest-bitrate video/audio streams preserved in MKV container",
        "ydl_opts": {
            "format": "bestvideo+bestaudio/best",
            "merge_output_format": "mkv",
        }
    },
    "audio_mp3": {
        "id": "audio_mp3",
        "name": "High-Quality Audio (MP3 320k)",
        "badge": "MP3 320k",
        "tag": "audio",
        "description": "Extracts audio and converts to high-bitrate MP3 with ID3 tags",
        "ydl_opts": {
            "format": "bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "320",
                }
            ]
        }
    },
    "audio_flac": {
        "id": "audio_flac",
        "name": "Lossless Audio (FLAC)",
        "badge": "FLAC Lossless",
        "tag": "audio",
        "description": "Extracts audio in lossless FLAC format",
        "ydl_opts": {
            "format": "bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "flac",
                }
            ]
        }
    },
    "audio_m4a": {
        "id": "audio_m4a",
        "name": "AAC / M4A (Apple)",
        "badge": "M4A",
        "tag": "audio",
        "description": "Extracts native AAC audio stream without re-encoding",
        "ydl_opts": {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "m4a",
                }
            ]
        }
    }
}

def get_preset_options(preset_id: str) -> Dict[str, Any]:
    preset = PRESETS.get(preset_id, PRESETS["best_video"])
    opts = {}
    for k, v in preset["ydl_opts"].items():
        if isinstance(v, list):
            opts[k] = [dict(item) if isinstance(item, dict) else item for item in v]
        else:
            opts[k] = v
    return opts
