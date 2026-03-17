"""File organizer endpoints."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.services.organizer import OrganizerService
from app.services.jellyfin import JellyfinService

router = APIRouter(prefix="/api/organizer", tags=["organizer"])


class OrganizeRequest(BaseModel):
    input_path: str
    output_path: Optional[str] = None
    dry_run: bool = False


@router.get("/scan")
async def scan_downloads():
    """Scan downloads directory for organizable files."""
    service = OrganizerService()
    files = service.scan_downloads()
    return {"files": files, "count": len(files)}


@router.post("/preview")
async def preview_rename(req: OrganizeRequest):
    """Preview what a file would be renamed to."""
    service = OrganizerService()
    return service.get_rename_preview(req.input_path)


@router.post("/organize")
async def organize_file(req: OrganizeRequest):
    """Organize a file (rename + move)."""
    service = OrganizerService()
    preview = service.get_rename_preview(req.input_path)
    if "error" in preview:
        return preview
    output = req.output_path or preview.get("proposed", "")
    return service.organize_file(req.input_path, output)


@router.post("/jellyfin/scan")
async def trigger_jellyfin_scan(library: Optional[str] = None):
    """Trigger Jellyfin library scan."""
    service = JellyfinService()
    return await service.trigger_library_scan(library)
