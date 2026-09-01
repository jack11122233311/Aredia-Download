# ⚡ ArediaDownload — The Media Downloader

A lightweight, modern web frontend and API for **yt-dlp** designed for Docker and local execution. Features native library callbacks, live Server-Sent Events (SSE) progress streaming, keyword title search, audio-only extraction, playlist batch picker, bottom-docked live CLI terminal, in-browser media player, auto-updater, and rich webhook notifications.

---

## ✨ Features & Capabilities

1. **One-Click Format Presets & Audio Extractor:** Highest Quality Video, 1080p MP4, 720p MP4, MP3 320kbps, Lossless FLAC, AAC M4A, OPUS, WAV, or custom yt-dlp format strings.
2. **Metadata Title Search:** Type any search query (e.g. `lofi hip hop`) directly in the search bar to find matching videos without a Google API key.
3. **Smart Playlist Interceptor & 50-Item Batch Picker:** Automatically prompts whether to download just the single video or inspect up to 50 playlist tracks interactively.
4. **Subfolder & Category Organization:** Organize media directly into `/downloads/Music/`, `/downloads/Podcasts/`, or custom directories.
5. **Subtitle / Closed-Caption Extractor:** Extract and embed English/multi-language subtitles (`FFmpegEmbedSubtitle`).
6. **Live Execution CLI Drawer:** Real-time dockable terminal streaming raw yt-dlp and FFmpeg postprocessor logs.
7. **In-App Cookie Manager:** Upload `cookies.txt` or paste Netscape-formatted cookies directly in the UI to bypass YouTube bot detection, age checks, and private video restrictions.
8. **SponsorBlock Integration:** Automatically removes sponsors, intros, outros, and filler segments during extraction.
9. **Metadata, Cover Art & Chapters:** Automatic ID3 / MP4 metadata tagging, high-res thumbnail embedding, and chapter markers.
10. **In-Browser File Manager & Mini-Player:** Stream finished videos and audio directly in your browser with seek/range-request support, download to local device, or delete.
11. **In-Container yt-dlp Auto-Updater:** Update `yt-dlp` in-place with a single click in the UI whenever YouTube changes algorithms.
12. **Discord & Telegram Webhooks:** Automated notifications delivered with video title, duration, filesize, and thumbnail upon completion.
13. **Concurrency & Speed Limiting:** Semaphore worker throttling (prevents CPU exhaustion during FFmpeg muxing) and optional `--limit-rate` bandwidth caps.

---

## 🚀 Quick Start

### 1. Local Windows Development Mode (1-Click)
```powershell
.\start_dev.ps1
```
Or double-click `start_dev.bat`. Open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

### 2. Docker Hot-Reload Testing Mode
```bash
docker compose -f docker-compose.dev.yml up --build
```

---

### 3. Production Docker Daemon Mode
```bash
docker compose up -d --build
```

---

## 📁 Volume Mounts & Persistence

| Host Path | Container Path | Purpose |
|---|---|---|
| `./downloads` | `/downloads` | Persistent storage for all completed video/audio files. |
| `./config` | `/config` | Stores `settings.json` and authentication `cookies.txt`. |

---

## 🔧 Environment Variables

You can customize runtime variables in `docker-compose.yml`:

| Variable | Default | Description |
|---|---|---|
| `MAX_CONCURRENT_DOWNLOADS` | `2` | Maximum concurrent downloads before queuing. |
| `PUID` / `PGID` | `1000` | User/Group ID to ensure downloaded files are not locked as root. |
| `DEFAULT_RATE_LIMIT` | `""` | Global bandwidth cap (e.g. `10M`, `2M`). |
| `DISCORD_WEBHOOK_URL` | `""` | Default Discord webhook URL for notifications. |
| `TELEGRAM_BOT_TOKEN` | `""` | Telegram bot token for completion messages. |
| `TELEGRAM_CHAT_ID` | `""` | Target Telegram channel/chat ID. |
