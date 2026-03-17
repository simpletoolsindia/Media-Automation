"""Media search and request endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.services.search import SearchService
from app.services.metadata_service import MetadataService

router = APIRouter(prefix="/api/media", tags=["media"])


class SearchRequest(BaseModel):
    query: str
    media_type: Optional[str] = "auto"
    year: Optional[str] = None


@router.post("/search")
async def search_media(req: SearchRequest):
    """Search for media across indexers."""
    service = SearchService()
    results = await service.search(req.query, req.media_type)
    return {"results": results, "count": len(results)}


@router.get("/metadata/{title}")
async def get_metadata(title: str, media_type: str = "movie", year: Optional[str] = None):
    """Fetch metadata from TMDB."""
    service = MetadataService()
    if media_type == "tv":
        results = await service.search_tv(title)
    else:
        results = await service.search_movie(title, year)
    return {"results": results}
