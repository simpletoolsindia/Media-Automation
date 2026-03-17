"""Settings and AI provider management endpoints."""
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Settings are stored in a dedicated data volume so Docker bind-mount issues
# (host directory created instead of file) never occur.
ENV_PATH = os.environ.get("SETTINGS_FILE", "/app/data/settings.env")


def _read_env() -> dict:
    """Read current settings file into dict."""
    data = {}
    if os.path.isfile(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    data[k.strip()] = v.strip().strip('"').strip("'")
    return data


def _write_env(updates: dict):
    """Persist updates to the settings file."""
    try:
        os.makedirs(os.path.dirname(ENV_PATH), exist_ok=True)
        existing = _read_env()
        existing.update(updates)
        lines = [f"{k}={v}" for k, v in existing.items()]
        with open(ENV_PATH, "w") as f:
            f.write("\n".join(lines) + "\n")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to write settings: {exc}")


@router.get("/")
async def get_settings():
    from app.config import Settings
    s = Settings()
    return {
        "ai_provider": s.ai_provider,
        "anthropic_model": s.anthropic_model,
        "openai_model": s.openai_model,
        "openai_base_url": s.openai_base_url,
        "ollama_url": s.ollama_url,
        "ollama_model": s.ollama_model,
        "lmstudio_url": s.lmstudio_url,
        "lmstudio_model": s.lmstudio_model,
        "deepseek_model": s.deepseek_model,
        "openrouter_model": s.openrouter_model,
        "openrouter_base_url": s.openrouter_base_url,
        "prowlarr_url": s.prowlarr_url,
        "qbittorrent_url": s.qbittorrent_url,
        "qbittorrent_use_existing": s.qbittorrent_use_existing,
        "jellyfin_url": s.jellyfin_url,
        "media_root": s.media_root,
        "downloads_path": s.downloads_path,
        "setup_complete": s.setup_complete,
        # Key presence (never send actual keys)
        "has_anthropic_key": bool(s.anthropic_api_key),
        "has_openai_key": bool(s.openai_api_key),
        "has_deepseek_key": bool(s.deepseek_api_key),
        "has_openrouter_key": bool(s.openrouter_api_key),
        "has_tmdb_key": bool(s.tmdb_api_key),
        "has_prowlarr_key": bool(s.prowlarr_api_key),
        "has_jellyfin_key": bool(s.jellyfin_api_key),
    }


class AIProviderUpdate(BaseModel):
    provider: str
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


@router.post("/ai-provider")
async def update_ai_provider(body: AIProviderUpdate):
    """Switch AI provider and optionally update its key/model."""
    valid = {"anthropic", "openai", "ollama", "lmstudio", "deepseek", "openrouter"}
    if body.provider not in valid:
        return {"error": f"Unknown provider. Valid: {valid}"}

    updates = {"AI_PROVIDER": body.provider}

    if body.api_key:
        key_map = {
            "anthropic": "ANTHROPIC_API_KEY",
            "openai": "OPENAI_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
            "openrouter": "OPENROUTER_API_KEY",
        }
        if body.provider in key_map:
            updates[key_map[body.provider]] = body.api_key

    if body.model:
        model_map = {
            "anthropic": "ANTHROPIC_MODEL",
            "openai": "OPENAI_MODEL",
            "ollama": "OLLAMA_MODEL",
            "lmstudio": "LMSTUDIO_MODEL",
            "deepseek": "DEEPSEEK_MODEL",
            "openrouter": "OPENROUTER_MODEL",
        }
        if body.provider in model_map:
            updates[model_map[body.provider]] = body.model

    if body.base_url:
        url_map = {
            "ollama": "OLLAMA_URL",
            "lmstudio": "LMSTUDIO_URL",
            "openrouter": "OPENROUTER_BASE_URL",
        }
        if body.provider in url_map:
            updates[url_map[body.provider]] = body.base_url

    _write_env(updates)
    # Bust the settings cache
    from app.config import get_settings
    get_settings.cache_clear()
    return {"status": "ok", "provider": body.provider}


class QBittorrentSetup(BaseModel):
    url: str
    username: Optional[str] = "admin"
    password: Optional[str] = "adminadmin"
    use_existing: bool = True


@router.post("/qbittorrent")
async def configure_qbittorrent(body: QBittorrentSetup):
    """Test and save qBittorrent connection."""
    # Test connection
    connected = False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{body.url}/api/v2/auth/login",
                data={"username": body.username, "password": body.password},
            )
            connected = resp.text == "Ok."
    except Exception:
        pass

    if not connected:
        return {"connected": False, "message": "Could not connect to qBittorrent at that URL"}

    _write_env({
        "QBITTORRENT_URL": body.url,
        "QBITTORRENT_USERNAME": body.username or "admin",
        "QBITTORRENT_PASSWORD": body.password or "adminadmin",
        "QBITTORRENT_USE_EXISTING": "true" if body.use_existing else "false",
    })
    from app.config import get_settings
    get_settings.cache_clear()
    return {"connected": True, "message": "qBittorrent connected successfully"}


class SetupComplete(BaseModel):
    pass


@router.post("/complete-setup")
async def complete_setup():
    """Mark setup as complete."""
    _write_env({"SETUP_COMPLETE": "true"})
    from app.config import get_settings
    get_settings.cache_clear()
    return {"status": "ok"}


class GeneralSettings(BaseModel):
    prowlarr_url: Optional[str] = None
    prowlarr_api_key: Optional[str] = None
    jellyfin_url: Optional[str] = None
    jellyfin_api_key: Optional[str] = None
    tmdb_api_key: Optional[str] = None
    media_root: Optional[str] = None
    downloads_path: Optional[str] = None


@router.post("/general")
async def update_general(body: GeneralSettings):
    updates = {}
    if body.prowlarr_url: updates["PROWLARR_URL"] = body.prowlarr_url
    if body.prowlarr_api_key: updates["PROWLARR_API_KEY"] = body.prowlarr_api_key
    if body.jellyfin_url: updates["JELLYFIN_URL"] = body.jellyfin_url
    if body.jellyfin_api_key: updates["JELLYFIN_API_KEY"] = body.jellyfin_api_key
    if body.tmdb_api_key: updates["TMDB_API_KEY"] = body.tmdb_api_key
    if body.media_root: updates["MEDIA_ROOT"] = body.media_root
    if body.downloads_path: updates["DOWNLOADS_PATH"] = body.downloads_path
    _write_env(updates)
    from app.config import get_settings
    get_settings.cache_clear()
    return {"status": "ok"}


@router.get("/health")
async def health_check():
    from app.config import Settings
    s = Settings()
    return {"status": "ok", "provider": s.ai_provider, "setup_complete": s.setup_complete}
