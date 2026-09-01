Write-Host "Starting ArediaDownload — The Media Downloader..." -ForegroundColor Cyan

$WorkspaceRoot = $PSScriptRoot
Set-Location $WorkspaceRoot

# Ensure persistent directories exist
if (-not (Test-Path "$WorkspaceRoot\downloads")) {
    New-Item -ItemType Directory -Path "$WorkspaceRoot\downloads" | Out-Null
}
if (-not (Test-Path "$WorkspaceRoot\config")) {
    New-Item -ItemType Directory -Path "$WorkspaceRoot\config" | Out-Null
}

# Check for ffmpeg
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "[NOTE] FFmpeg is not detected on Windows host PATH." -ForegroundColor Yellow
    Write-Host "       For full audio conversion (MP3) & 1080p/4K muxing on Windows outside Docker, run:" -ForegroundColor Yellow
    Write-Host "       winget install Gyan.FFmpeg -e" -ForegroundColor Green
}

# Install dependencies if needed
python -m pip install -r "$WorkspaceRoot\backend\requirements.txt"

# Launch FastAPI Dev Server with live reload
Set-Location "$WorkspaceRoot\backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
