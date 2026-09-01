import json
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.queue_manager import queue_manager
from app.presets import PRESETS

router = APIRouter(prefix="/api/downloads", tags=["downloads"])

class DownloadRequest(BaseModel):
    url: str
    preset_id: str = "best_video"
    mode: str = "video"  # "video" or "audio"
    audio_format: str = "mp3"  # mp3, flac, m4a, opus, wav
    audio_bitrate: str = "320"  # 320, 256, 192, 0
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    normalize_audio: bool = False
    sponsorblock: bool = True
    rate_limit: Optional[str] = None
    custom_format: Optional[str] = None
    subfolder: Optional[str] = None
    noplaylist: bool = False
    embed_subtitles: bool = False

class BatchDownloadRequest(BaseModel):
    urls: List[str]
    preset_id: str = "best_video"
    mode: str = "video"
    audio_format: str = "mp3"
    audio_bitrate: str = "320"
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    normalize_audio: bool = False
    sponsorblock: bool = True
    rate_limit: Optional[str] = None
    custom_format: Optional[str] = None
    subfolder: Optional[str] = None
    noplaylist: bool = False
    embed_subtitles: bool = False

@router.get("/presets")
async def get_presets():
    return list(PRESETS.values())

@router.post("/single")
async def start_single_download(req: DownloadRequest):
    if not req.url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    
    custom_args = {
        "mode": req.mode,
        "audio_format": req.audio_format,
        "audio_bitrate": req.audio_bitrate,
        "start_time": req.start_time,
        "end_time": req.end_time,
        "normalize_audio": req.normalize_audio,
        "sponsorblock": req.sponsorblock,
        "rate_limit": req.rate_limit,
        "custom_format": req.custom_format,
        "subfolder": req.subfolder,
        "noplaylist": req.noplaylist,
        "embed_subtitles": req.embed_subtitles,
    }
    task_id = await queue_manager.add_task(
        url=req.url.strip(),
        preset_id=req.preset_id,
        custom_args=custom_args
    )
    return {"status": "queued", "task_id": task_id}

@router.post("/batch")
async def start_batch_download(req: BatchDownloadRequest):
    if not req.urls:
        raise HTTPException(status_code=400, detail="URL list cannot be empty")
    
    task_ids = []
    custom_args = {
        "mode": req.mode,
        "audio_format": req.audio_format,
        "audio_bitrate": req.audio_bitrate,
        "start_time": req.start_time,
        "end_time": req.end_time,
        "normalize_audio": req.normalize_audio,
        "sponsorblock": req.sponsorblock,
        "rate_limit": req.rate_limit,
        "custom_format": req.custom_format,
        "subfolder": req.subfolder,
        "noplaylist": req.noplaylist,
        "embed_subtitles": req.embed_subtitles,
    }
    for url in req.urls:
        if url.strip():
            tid = await queue_manager.add_task(
                url=url.strip(),
                preset_id=req.preset_id,
                custom_args=custom_args
            )
            task_ids.append(tid)
            
    return {"status": "queued", "task_ids": task_ids, "count": len(task_ids)}

@router.post("/cancel/{task_id}")
async def cancel_download(task_id: str):
    success = await queue_manager.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found or already finished")
    return {"status": "cancelled", "task_id": task_id}

@router.delete("/clear")
async def clear_finished_tasks():
    queue_manager.clear_finished()
    return {"status": "cleared"}

@router.get("/queue")
async def get_all_tasks():
    return [queue_manager._task_to_dict(t) for t in queue_manager.tasks.values()]

@router.get("/stream")
async def sse_stream():
    """Real-time SSE stream for download progress, CLI logs, and task events."""
    async def event_generator():
        q = await queue_manager.subscribe()
        try:
            while True:
                data = await q.get()
                yield {
                    "event": "message",
                    "data": json.dumps(data)
                }
        except asyncio.CancelledError:
            pass
        finally:
            queue_manager.unsubscribe(q)

    return EventSourceResponse(event_generator())
