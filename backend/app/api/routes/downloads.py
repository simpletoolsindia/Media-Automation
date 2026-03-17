"""Download management endpoints."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.services.downloader import DownloadService

router = APIRouter(prefix="/api/downloads", tags=["downloads"])


class AddDownloadRequest(BaseModel):
    magnet: str
    title: str
    media_type: Optional[str] = "movie"


@router.get("/")
async def list_downloads():
    """List all active downloads."""
    service = DownloadService()
    torrents = await service.get_torrents()
    return {"downloads": torrents}


@router.post("/add")
async def add_download(req: AddDownloadRequest):
    """Add a new download."""
    service = DownloadService()
    result = await service.add_torrent(req.magnet)
    return result


@router.delete("/{torrent_hash}")
async def remove_download(torrent_hash: str, delete_files: bool = False):
    """Remove a download."""
    service = DownloadService()
    success = await service.remove_torrent(torrent_hash, delete_files)
    return {"success": success}
