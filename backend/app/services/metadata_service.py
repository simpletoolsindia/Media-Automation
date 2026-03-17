"""TMDB metadata fetching service."""
import httpx
import json
from typing import Optional
from app.config import get_settings

settings = get_settings()

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"


class MetadataService:
    def __init__(self):
        self.api_key = settings.tmdb_api_key

    async def search_movie(self, title: str, year: Optional[str] = None) -> list[dict]:
        """Search TMDB for movies."""
        params = {"api_key": self.api_key, "query": title, "include_adult": False}
        if year:
            params["year"] = year

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{TMDB_BASE}/search/movie", params=params)
                resp.raise_for_status()
                results = resp.json().get("results", [])
                return [self._format_movie(r) for r in results[:5]]
        except Exception as e:
            print(f"TMDB search error: {e}")
            return []

    async def search_tv(self, title: str) -> list[dict]:
        """Search TMDB for TV shows."""
        params = {"api_key": self.api_key, "query": title}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{TMDB_BASE}/search/tv", params=params)
                resp.raise_for_status()
                results = resp.json().get("results", [])
                return [self._format_tv(r) for r in results[:5]]
        except Exception as e:
            print(f"TMDB TV search error: {e}")
            return []

    async def get_movie_details(self, tmdb_id: int) -> Optional[dict]:
        """Get full movie details from TMDB."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{TMDB_BASE}/movie/{tmdb_id}",
                    params={"api_key": self.api_key},
                )
                resp.raise_for_status()
                return self._format_movie(resp.json())
        except Exception:
            return None

    def _format_movie(self, data: dict) -> dict:
        poster = data.get("poster_path")
        backdrop = data.get("backdrop_path")
        return {
            "tmdb_id": data.get("id"),
            "title": data.get("title", ""),
            "year": (data.get("release_date") or "")[:4],
            "overview": data.get("overview", ""),
            "rating": str(data.get("vote_average", "")),
            "poster_url": f"{TMDB_IMAGE_BASE}{poster}" if poster else None,
            "backdrop_url": f"{TMDB_IMAGE_BASE}{backdrop}" if backdrop else None,
            "genres": json.dumps([g["name"] for g in data.get("genres", [])]),
            "media_type": "movie",
        }

    def _format_tv(self, data: dict) -> dict:
        poster = data.get("poster_path")
        backdrop = data.get("backdrop_path")
        return {
            "tmdb_id": data.get("id"),
            "title": data.get("name", ""),
            "year": (data.get("first_air_date") or "")[:4],
            "overview": data.get("overview", ""),
            "rating": str(data.get("vote_average", "")),
            "poster_url": f"{TMDB_IMAGE_BASE}{poster}" if poster else None,
            "backdrop_url": f"{TMDB_IMAGE_BASE}{backdrop}" if backdrop else None,
            "genres": json.dumps([g["name"] for g in data.get("genre_ids", [])]),
            "media_type": "tv",
        }
