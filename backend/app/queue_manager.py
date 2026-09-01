import asyncio
import uuid
import time
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field, asdict

from app.downloader import DownloadWorker, format_bytes
from app.config import load_settings
from app.notifications import dispatch_notification

logger = logging.getLogger(__name__)

@dataclass
class DownloadTask:
    id: str
    url: str
    preset_id: str = "best_video"
    status: str = "queued"  # queued, starting, downloading, processing, completed, failed, cancelled
    percent: float = 0.0
    speed_str: str = "0 B/s"
    eta_str: str = "--"
    downloaded_str: str = "0 B"
    total_str: str = "0 B"
    title: str = "Fetching video details..."
    uploader: str = ""
    duration_str: str = ""
    thumbnail: str = ""
    error: str = ""
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    custom_args: Dict[str, Any] = field(default_factory=dict)
    worker: Optional[Any] = None

class QueueManager:
    def __init__(self):
        self.tasks: Dict[str, DownloadTask] = {}
        self.queue: asyncio.Queue = asyncio.Queue()
        self.subscribers: List[asyncio.Queue] = []
        self.semaphore: Optional[asyncio.Semaphore] = None
        self._worker_task: Optional[asyncio.Task] = None
        self.is_running = False

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        settings = load_settings()
        max_workers = settings.get("max_concurrent_downloads", 2)
        self.semaphore = asyncio.Semaphore(max_workers)
        self._worker_task = asyncio.create_task(self._queue_consumer())
        logger.info(f"Queue manager started with max {max_workers} concurrent downloads")

    async def update_concurrency(self, new_limit: int):
        self.semaphore = asyncio.Semaphore(max(1, new_limit))

    async def add_task(self, url: str, preset_id: str = "best_video", custom_args: Optional[Dict[str, Any]] = None) -> str:
        task_id = str(uuid.uuid4())[:8]
        task = DownloadTask(
            id=task_id,
            url=url,
            preset_id=preset_id,
            custom_args=custom_args or {}
        )
        self.tasks[task_id] = task
        await self.queue.put(task_id)
        await self.broadcast_event({"type": "task_added", "task": self._task_to_dict(task)})
        return task_id

    async def cancel_task(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        if not task:
            return False

        if task.status in ["completed", "failed", "cancelled"]:
            return False

        task.status = "cancelled"
        if task.worker:
            task.worker.cancelled = True

        await self.broadcast_event({"type": "task_updated", "task": self._task_to_dict(task)})
        return True

    def clear_finished(self):
        to_delete = [tid for tid, t in self.tasks.items() if t.status in ["completed", "failed", "cancelled"]]
        for tid in to_delete:
            del self.tasks[tid]

    async def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self.subscribers.append(q)
        # Send initial snapshot
        snapshot = [self._task_to_dict(t) for t in self.tasks.values()]
        await q.put({"type": "snapshot", "tasks": snapshot})
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self.subscribers:
            self.subscribers.remove(q)

    async def broadcast_event(self, data: Dict[str, Any]):
        for sub in list(self.subscribers):
            try:
                await sub.put(data)
            except Exception:
                self.unsubscribe(sub)

    def _task_to_dict(self, task: DownloadTask) -> Dict[str, Any]:
        d = asdict(task)
        d.pop("worker", None)
        return d

    async def _queue_consumer(self):
        while self.is_running:
            task_id = await self.queue.get()
            task = self.tasks.get(task_id)
            if not task or task.status == "cancelled":
                self.queue.task_done()
                continue

            asyncio.create_task(self._process_task(task))
            self.queue.task_done()

    async def _process_task(self, task: DownloadTask):
        assert self.semaphore is not None
        async with self.semaphore:
            if task.status == "cancelled":
                return

            task.status = "starting"
            await self.broadcast_event({"type": "task_updated", "task": self._task_to_dict(task)})

            loop = asyncio.get_running_loop()

            def on_progress_sync(data: Dict[str, Any]):
                if "percent" in data:
                    task.percent = data["percent"]
                if "speed_str" in data:
                    task.speed_str = data["speed_str"]
                if "eta_str" in data:
                    task.eta_str = data["eta_str"]
                if "downloaded_str" in data:
                    task.downloaded_str = data["downloaded_str"]
                if "total_str" in data:
                    task.total_str = data["total_str"]
                if "status" in data:
                    task.status = data["status"]
                if "meta" in data:
                    meta = data["meta"]
                    task.title = meta.get("title", task.title)
                    task.uploader = meta.get("uploader", task.uploader)
                    task.duration_str = meta.get("duration_str", task.duration_str)
                    task.thumbnail = meta.get("thumbnail", task.thumbnail)

                asyncio.run_coroutine_threadsafe(
                    self.broadcast_event({"type": "task_progress", "task": self._task_to_dict(task)}),
                    loop
                )

            def on_log_sync(task_id: str, line: str):
                asyncio.run_coroutine_threadsafe(
                    self.broadcast_event({
                        "type": "log",
                        "task_id": task_id,
                        "line": line,
                        "timestamp": time.strftime("%H:%M:%S")
                    }),
                    loop
                )

            worker = DownloadWorker(
                task_id=task.id,
                url=task.url,
                preset_id=task.preset_id,
                custom_args=task.custom_args,
                on_progress=on_progress_sync,
                on_log=on_log_sync
            )
            task.worker = worker

            try:
                meta = await asyncio.to_thread(worker.run)
                task.status = "completed"
                task.percent = 100.0
                task.completed_at = time.time()
                task.title = meta.get("title", task.title)
                task.uploader = meta.get("uploader", task.uploader)
                task.duration_str = meta.get("duration_str", task.duration_str)
                task.thumbnail = meta.get("thumbnail", task.thumbnail)

                # Send Webhook Notification (Feature 8)
                settings = load_settings()
                dispatch_notification(
                    settings=settings,
                    title=task.title,
                    status="completed",
                    details={
                        "url": task.url,
                        "uploader": task.uploader,
                        "duration_str": task.duration_str,
                        "filesize_str": task.total_str or task.downloaded_str,
                        "preset_name": meta.get("preset_name", task.preset_id),
                        "thumbnail": task.thumbnail
                    }
                )

            except Exception as e:
                if task.status != "cancelled":
                    task.status = "failed"
                    task.error = str(e)
                    task.completed_at = time.time()
                    
                    settings = load_settings()
                    dispatch_notification(
                        settings=settings,
                        title=task.title or task.url,
                        status="failed",
                        details={"url": task.url, "error": str(e)}
                    )
            finally:
                await self.broadcast_event({"type": "task_updated", "task": self._task_to_dict(task)})

queue_manager = QueueManager()
