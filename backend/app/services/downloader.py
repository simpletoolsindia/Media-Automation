"""qBittorrent download service."""
import httpx
from app.config import get_settings

settings = get_settings()


class DownloadService:
    def __init__(self):
        self.base_url = settings.qbittorrent_url
        self.username = settings.qbittorrent_username
        self.password = settings.qbittorrent_password
        self._session_cookie = None

    async def _login(self, client: httpx.AsyncClient) -> bool:
        try:
            resp = await client.post(
                f"{self.base_url}/api/v2/auth/login",
                data={"username": self.username, "password": self.password},
            )
            return resp.text == "Ok."
        except Exception:
            return False

    async def add_torrent(self, magnet: str, save_path: str = None) -> dict:
        """Add torrent to qBittorrent."""
        save_path = save_path or settings.downloads_path
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await self._login(client)
                data = {"urls": magnet, "savepath": save_path}
                resp = await client.post(
                    f"{self.base_url}/api/v2/torrents/add",
                    data=data,
                )
                return {"success": resp.text == "Ok.", "message": resp.text}
        except Exception as e:
            return {"success": False, "message": str(e)}

    async def get_torrents(self) -> list[dict]:
        """Get all torrents with their status."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await self._login(client)
                resp = await client.get(f"{self.base_url}/api/v2/torrents/info")
                resp.raise_for_status()
                torrents = resp.json()
                return [
                    {
                        "hash": t.get("hash", ""),
                        "name": t.get("name", ""),
                        "progress": round(t.get("progress", 0) * 100, 1),
                        "status": self._map_state(t.get("state", "")),
                        "size": t.get("size", 0),
                        "dlspeed": t.get("dlspeed", 0),
                        "eta": t.get("eta", 0),
                        "save_path": t.get("save_path", ""),
                    }
                    for t in torrents
                ]
        except Exception as e:
            print(f"Get torrents error: {e}")
            return []

    async def remove_torrent(self, torrent_hash: str, delete_files: bool = False) -> bool:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await self._login(client)
                resp = await client.post(
                    f"{self.base_url}/api/v2/torrents/delete",
                    data={"hashes": torrent_hash, "deleteFiles": str(delete_files).lower()},
                )
                return resp.status_code == 200
        except Exception:
            return False

    def _map_state(self, state: str) -> str:
        mapping = {
            "downloading": "downloading",
            "seeding": "done",
            "pausedDL": "paused",
            "pausedUP": "done",
            "stalledDL": "stalled",
            "error": "error",
            "missingFiles": "error",
            "checkingDL": "checking",
            "checkingUP": "checking",
        }
        return mapping.get(state, state)
