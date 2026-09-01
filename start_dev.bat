@echo off
echo Starting ArediaDownload - The Media Downloader...
cd /d "%~dp0"
if not exist "downloads" mkdir downloads
if not exist "config" mkdir config

where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [NOTE] FFmpeg not found on Windows PATH.
    echo        For full MP3 extraction and 1080p/4K muxing outside Docker, run:
    echo        winget install Gyan.FFmpeg -e
    echo.
)

python -m pip install -r backend/requirements.txt
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
