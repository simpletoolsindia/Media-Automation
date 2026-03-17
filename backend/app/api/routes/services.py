"""Service management: detect, install, and configure optional media services."""
import os
import asyncio
import httpx
import docker as docker_sdk
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/services", tags=["services"])

STORAGE_PATH = os.environ.get("STORAGE_PATH", "/mnt/data4tb")
PROJECT = os.environ.get("COMPOSE_PROJECT_NAME", "media-organizor")

# ── Service definitions ────────────────────────────────────────────────────────

SERVICES = {
    "qbittorrent": {
        "label": "qBittorrent",
        "image": "lscr.io/linuxserver/qbittorrent:latest",
        "container_name": f"{PROJECT}-qbittorrent-1",
        "ports": {"8080/tcp": 1116, "6881/tcp": 1117},
        "environment": {
            "PUID": "1000", "PGID": "1000",
            "TZ": "UTC", "WEBUI_PORT": "8080",
        },
        "volumes": {
            f"{PROJECT}_qbittorrent_config": {"bind": "/config", "mode": "rw"},
            f"{STORAGE_PATH}/downloads": {"bind": "/downloads", "mode": "rw"},
        },
        "default_port": 1116,
        "detect_path": "/api/v2/app/version",
        "needs_credentials": True,
    },
    "prowlarr": {
        "label": "Prowlarr",
        "image": "lscr.io/linuxserver/prowlarr:latest",
        "container_name": f"{PROJECT}-prowlarr-1",
        "ports": {"9696/tcp": 1118},
        "environment": {"PUID": "1000", "PGID": "1000", "TZ": "UTC"},
        "volumes": {
            f"{PROJECT}_prowlarr_data": {"bind": "/config", "mode": "rw"},
        },
        "default_port": 1118,
        "detect_path": "/",
        "needs_credentials": False,
    },
    "jellyfin": {
        "label": "Jellyfin",
        "image": "jellyfin/jellyfin:latest",
        "container_name": f"{PROJECT}-jellyfin-1",
        "ports": {"8096/tcp": 1119},
        "environment": {},
        "volumes": {
            f"{PROJECT}_jellyfin_config": {"bind": "/config", "mode": "rw"},
            f"{STORAGE_PATH}/media": {"bind": "/media", "mode": "ro"},
        },
        "default_port": 1119,
        "detect_path": "/health",
        "needs_credentials": False,
    },
}


def _docker_client():
    try:
        return docker_sdk.from_env()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Docker socket unavailable: {exc}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_services():
    """Return all service definitions with their detect URLs."""
    result = {}
    for key, cfg in SERVICES.items():
        result[key] = {
            "label": cfg["label"],
            "default_url": f"http://localhost:{cfg['default_port']}",
            "needs_credentials": cfg["needs_credentials"],
        }
    return result


@router.get("/detect/{service}")
async def detect_service(service: str):
    """
    Try to reach the service at common localhost ports.
    Returns {found: bool, url: str}.
    """
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Unknown service")

    cfg = SERVICES[service]
    candidates = [
        f"http://localhost:{cfg['default_port']}",
        f"http://host.docker.internal:{cfg['default_port']}",
    ]

    for url in candidates:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                await client.get(f"{url}{cfg['detect_path']}")
            return {"found": True, "url": f"http://localhost:{cfg['default_port']}"}
        except Exception:
            continue

    # Also check if container is running
    try:
        dc = _docker_client()
        containers = dc.containers.list(filters={"name": service})
        if containers:
            return {"found": True, "url": f"http://localhost:{cfg['default_port']}", "via": "docker"}
    except Exception:
        pass

    return {"found": False, "url": f"http://localhost:{cfg['default_port']}"}


@router.get("/status/{service}")
async def service_status(service: str):
    """Check if a service container exists and its state."""
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Unknown service")
    try:
        dc = _docker_client()
        containers = dc.containers.list(all=True, filters={"name": service})
        if not containers:
            return {"running": False, "exists": False}
        c = containers[0]
        return {"running": c.status == "running", "exists": True, "status": c.status}
    except Exception as exc:
        return {"running": False, "exists": False, "error": str(exc)}


class InstallRequest(BaseModel):
    restart: bool = False   # force recreate even if already running


@router.post("/install/{service}")
async def install_service(service: str, body: InstallRequest = InstallRequest()):
    """
    Pull the image and start the service container via Docker SDK.
    The container joins the same compose network as the rest of the stack.
    """
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Unknown service")

    cfg = SERVICES[service]
    dc = _docker_client()

    # Stop + remove existing container if restart requested
    if body.restart:
        try:
            existing = dc.containers.get(cfg["container_name"])
            existing.stop(timeout=5)
            existing.remove()
        except docker_sdk.errors.NotFound:
            pass

    # Check if already running
    try:
        existing = dc.containers.get(cfg["container_name"])
        if existing.status == "running":
            return {"status": "already_running", "url": f"http://localhost:{cfg['default_port']}"}
        existing.start()
        return {"status": "started", "url": f"http://localhost:{cfg['default_port']}"}
    except docker_sdk.errors.NotFound:
        pass

    # Pull image (may take a minute)
    try:
        dc.images.pull(cfg["image"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to pull image: {exc}")

    # Ensure named volumes exist
    for vol_name in cfg["volumes"]:
        if not vol_name.startswith("/"):
            try:
                dc.volumes.create(name=vol_name)
            except Exception:
                pass

    # Create and start container
    network_name = f"{PROJECT}_default"
    try:
        container = dc.containers.run(
            cfg["image"],
            name=cfg["container_name"],
            detach=True,
            ports=cfg["ports"],
            environment=cfg["environment"],
            volumes=cfg["volumes"],
            network=network_name,
            restart_policy={"Name": "unless-stopped"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to start container: {exc}")

    # Wait up to 15 s for the service to respond
    url = f"http://localhost:{cfg['default_port']}"
    for _ in range(15):
        await asyncio.sleep(1)
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                await client.get(f"http://host.docker.internal:{cfg['default_port']}{cfg['detect_path']}")
            return {"status": "running", "url": url}
        except Exception:
            continue

    return {"status": "starting", "url": url, "note": "Container started but not yet ready — try again in a moment"}


class ValidateRequest(BaseModel):
    url: str
    username: Optional[str] = None
    password: Optional[str] = None


@router.post("/validate/{service}")
async def validate_service(service: str, body: ValidateRequest):
    """Test connectivity to a user-provided service URL."""
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Unknown service")

    cfg = SERVICES[service]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            if service == "qbittorrent" and body.username:
                resp = await client.post(
                    f"{body.url}/api/v2/auth/login",
                    data={"username": body.username, "password": body.password},
                )
                ok = resp.text == "Ok."
            else:
                resp = await client.get(f"{body.url}{cfg['detect_path']}")
                ok = resp.status_code < 500
        return {"connected": ok, "url": body.url}
    except Exception as exc:
        return {"connected": False, "error": str(exc)}
