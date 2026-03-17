"""Service management: detect, install, and configure optional media services."""
import os
import asyncio
import httpx
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
        "detect_paths": ["/api/v2/app/version"],
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
        "detect_paths": ["/", "/api/v1/health"],
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
        "detect_paths": ["/health", "/System/Ping", "/"],
        "needs_credentials": False,
    },
}


def _make_client(timeout: float = 5.0) -> httpx.AsyncClient:
    """httpx client that tolerates self-signed certs and follows redirects."""
    return httpx.AsyncClient(timeout=timeout, verify=False, follow_redirects=True)


async def _try_reach(base_url: str, paths: list[str]) -> bool:
    """Return True if any path on base_url responds with status < 500."""
    async with _make_client(timeout=3.0) as client:
        for path in paths:
            try:
                r = await client.get(f"{base_url}{path}")
                if r.status_code < 500:
                    return True
            except Exception:
                continue
    return False


def _docker_client():
    """Return Docker SDK client or None (never raises)."""
    try:
        import docker as docker_sdk
        return docker_sdk.from_env()
    except Exception:
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_services():
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
    Try to reach the service on common ports / host gateway.
    Always returns JSON {found, url} — never raises.
    """
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Unknown service")

    cfg = SERVICES[service]
    default_url = f"http://localhost:{cfg['default_port']}"
    candidates = [
        f"http://localhost:{cfg['default_port']}",
        f"http://host.docker.internal:{cfg['default_port']}",
    ]

    for base in candidates:
        if await _try_reach(base, cfg["detect_paths"]):
            return {"found": True, "url": default_url}

    # Fallback: check via Docker SDK (optional — safe if socket not mounted)
    dc = _docker_client()
    if dc:
        try:
            containers = dc.containers.list(filters={"name": service})
            if containers:
                return {"found": True, "url": default_url, "via": "docker"}
        except Exception:
            pass

    return {"found": False, "url": default_url}


@router.get("/status/{service}")
async def service_status(service: str):
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Unknown service")
    dc = _docker_client()
    if not dc:
        return {"running": False, "exists": False, "error": "Docker socket not available"}
    try:
        containers = dc.containers.list(all=True, filters={"name": service})
        if not containers:
            return {"running": False, "exists": False}
        c = containers[0]
        return {"running": c.status == "running", "exists": True, "status": c.status}
    except Exception as exc:
        return {"running": False, "exists": False, "error": str(exc)}


class InstallRequest(BaseModel):
    restart: bool = False


@router.post("/install/{service}")
async def install_service(service: str, body: InstallRequest = InstallRequest()):
    """Pull image and start container via Docker SDK."""
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Unknown service")

    dc = _docker_client()
    if not dc:
        raise HTTPException(status_code=500, detail="Docker socket not available — make sure /var/run/docker.sock is mounted in the backend container")

    cfg = SERVICES[service]
    import docker as docker_sdk

    if body.restart:
        try:
            existing = dc.containers.get(cfg["container_name"])
            existing.stop(timeout=5)
            existing.remove()
        except docker_sdk.errors.NotFound:
            pass

    # Already exists?
    try:
        existing = dc.containers.get(cfg["container_name"])
        if existing.status == "running":
            return {"status": "already_running", "url": f"http://localhost:{cfg['default_port']}"}
        existing.start()
        return {"status": "started", "url": f"http://localhost:{cfg['default_port']}"}
    except docker_sdk.errors.NotFound:
        pass

    # Pull image
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

    # Create and start
    network_name = f"{PROJECT}_default"
    try:
        dc.containers.run(
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

    # Wait up to 20s for ready
    url = f"http://localhost:{cfg['default_port']}"
    for _ in range(20):
        await asyncio.sleep(1)
        if await _try_reach(
            f"http://host.docker.internal:{cfg['default_port']}",
            cfg["detect_paths"],
        ):
            return {"status": "running", "url": url}

    return {"status": "starting", "url": url, "note": "Started — may need a few more seconds"}


class ValidateRequest(BaseModel):
    url: str
    username: Optional[str] = None
    password: Optional[str] = None


@router.post("/validate/{service}")
async def validate_service(service: str, body: ValidateRequest):
    """
    Test connectivity to a user-provided URL.
    Accepts HTTPS with self-signed certs, follows redirects.
    """
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Unknown service")

    cfg = SERVICES[service]
    url = body.url.rstrip("/")

    try:
        async with _make_client(timeout=8.0) as client:
            if service == "qbittorrent" and body.username:
                resp = await client.post(
                    f"{url}/api/v2/auth/login",
                    data={"username": body.username, "password": body.password or ""},
                )
                ok = resp.text.strip() == "Ok."
                if not ok:
                    return {"connected": False, "error": f"Login failed (got: {resp.text.strip()[:60]!r})"}
            else:
                # Try each detect path; succeed if any returns < 500
                ok = False
                for path in cfg["detect_paths"]:
                    try:
                        r = await client.get(f"{url}{path}")
                        if r.status_code < 500:
                            ok = True
                            break
                    except Exception:
                        continue
                if not ok:
                    return {"connected": False, "error": "Service reachable but returned error — check URL"}

        return {"connected": True, "url": url}
    except httpx.ConnectError as exc:
        return {"connected": False, "error": f"Cannot connect: {exc}"}
    except httpx.TimeoutException:
        return {"connected": False, "error": "Connection timed out — check URL and firewall"}
    except Exception as exc:
        return {"connected": False, "error": str(exc)}
