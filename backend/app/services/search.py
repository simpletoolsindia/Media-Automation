"""Prowlarr/Jackett search service."""
import httpx
from typing import Optional
from app.config import get_settings

settings = get_settings()


class SearchService:
    def __init__(self):
        self.base_url = settings.prowlarr_url
        self.api_key = settings.prowlarr_api_key

    async def search(self, query: str, media_type: Optional[str] = None) -> list[dict]:
        """Search for media using Prowlarr."""
        params = {
            "query": query,
            "apikey": self.api_key,
            "type": "search",
        }
        if media_type == "movie":
            params["type"] = "movie"
        elif media_type == "tv":
            params["type"] = "tvsearch"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/v1/search",
                    params=params,
                )
                response.raise_for_status()
                data = response.json()
                return self._normalize_results(data)
        except Exception as e:
            print(f"Search error: {e}")
            return []

    def _normalize_results(self, results: list) -> list[dict]:
        """Normalize Prowlarr results into a standard format."""
        normalized = []
        for item in results[:20]:  # limit to 20 results
            normalized.append({
                "title": item.get("title", ""),
                "magnet": item.get("magnetUrl", ""),
                "download_url": item.get("downloadUrl", ""),
                "size": item.get("size", 0),
                "seeders": item.get("seeders", 0),
                "leechers": item.get("leechers", 0),
                "quality": self._parse_quality(item.get("title", "")),
                "indexer": item.get("indexer", ""),
                "publish_date": item.get("publishDate", ""),
            })
        # Sort by seeders descending
        normalized.sort(key=lambda x: x["seeders"], reverse=True)
        return normalized

    def _parse_quality(self, title: str) -> str:
        """Extract quality from title string."""
        title_lower = title.lower()
        if "2160p" in title_lower or "4k" in title_lower:
            return "4K"
        elif "1080p" in title_lower:
            return "1080p"
        elif "720p" in title_lower:
            return "720p"
        elif "480p" in title_lower:
            return "480p"
        return "Unknown"
