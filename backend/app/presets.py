from typing import Dict, Any

PRESETS: Dict[str, Dict[str, Any]] = {
    "best_video": {
        "id": "best_video",
        "name": "Best Quality Video",
        "badge": "Video (Auto)",
        "description": "Highest resolution video + audio automatically merged (MP4/MKV)",
        "ydl_opts": {
            "format": "bestvideo+bestaudio/best",
            "merge_output_format": "mp4",
        }
    },
    "video_1080p": {
        "id": "video_1080p",
        "name": "1080p Full HD (MP4)",
        "badge": "1080p MP4",
        "description": "Standard 1080p video, compatible with almost all media players",
        "ydl_opts": {
            "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
            "merge_output_format": "mp4",
        }
    },
    "video_720p": {
        "id": "video_720p",
        "name": "720p HD (Fast & Compact)",
        "badge": "720p MP4",
        "description": "Quick download, smaller file size, great for mobile viewing",
        "ydl_opts": {
            "format": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
            "merge_output_format": "mp4",
        }
    },
    "audio_mp3": {
        "id": "audio_mp3",
        "name": "High-Quality Audio (MP3 320k)",
        "badge": "MP3 320kbps",
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
        "name": "AAC / M4A (Original Apple Format)",
        "badge": "M4A",
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
    # Return a deep copy of ydl_opts
    opts = {}
    for k, v in preset["ydl_opts"].items():
        if isinstance(v, list):
            opts[k] = [dict(item) if isinstance(item, dict) else item for item in v]
        else:
            opts[k] = v
    return opts
