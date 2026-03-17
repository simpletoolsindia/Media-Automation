"""Jellyfin integration service."""
import httpx
from typing import Optional
from app.config import get_settings

settings = get_settings()


class JellyfinService:
    def __init__(self):
        self.base_url = settings.jellyfin_url
        self.api_key = settings.jellyfin_api_key

    @property
    def headers(self) -> dict:
        return {
            "X-Emby-Token": self.api_key,
            "Content-Type": "application/json",
        }

    async def trigger_library_scan(self, library_name: Optional[str] = None) -> dict:
        """Trigger a Jellyfin library scan."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if library_name:
                    # Get library ID first
                    resp = await client.get(
                        f"{self.base_url}/Library/VirtualFolders",
                        headers=self.headers,
                    )
                    libraries = resp.json()
                    library_id = next(
                        (lib["ItemId"] for lib in libraries if lib["Name"] == library_name),
                        None,
                    )
                    if library_id:
                        await client.post(
                            f"{self.base_url}/Items/{library_id}/Refresh",
                            headers=self.headers,
                        )
                else:
                    await client.post(
                        f"{self.base_url}/Library/Refresh",
                        headers=self.headers,
                    )
                return {"success": True, "message": "Library scan triggered"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_libraries(self) -> list[dict]:
        """Get all Jellyfin libraries."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{self.base_url}/Library/VirtualFolders",
                    headers=self.headers,
                )
                resp.raise_for_status()
                return [
                    {"id": lib.get("ItemId"), "name": lib.get("Name"), "type": lib.get("CollectionType")}
                    for lib in resp.json()
                ]
        except Exception as e:
            print(f"Jellyfin error: {e}")
            return []

    async def get_stats(self) -> dict:
        """Get Jellyfin library stats."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{self.base_url}/Items/Counts",
                    headers=self.headers,
                )
                resp.raise_for_status()
                return resp.json()
        except Exception:
            return {}
