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
        "common_ports": [8080],          # default qBittorrent WebUI port
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
        "common_ports": [9696],          # default Prowlarr port
        "detect_paths": ["/api/v1/health", "/login", "/"],
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
        "common_ports": [8096],          # default Jellyfin port
        "detect_paths": ["/health", "/System/Ping", "/"],
        "needs_credentials": False,
    },
}


def _make_client(timeout: float = 5.0) -> httpx.AsyncClient:
    """httpx client that tolerates self-signed certs and follows redirects."""
    return httpx.AsyncClient(timeout=timeout, verify=False, follow_redirects=True)


async def _try_reach(base_url: str, paths: list[str]) -> bool:
    """Return True if any path on base_url gets any HTTP response (even 5xx = service is up)."""
    async with _make_client(timeout=3.0) as client:
        for path in paths:
            try:
                await client.get(f"{base_url}{path}")
                return True   # any HTTP response = server is running
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


def _candidate_urls(cfg: dict) -> list[str]:
    """Return all (base_url, is_host_docker) candidates to probe, preferred first."""
    ports = [cfg["default_port"]] + cfg.get("common_ports", [])
    candidates = []
    for port in ports:
        candidates.append(f"http://localhost:{port}")
        candidates.append(f"http://host.docker.internal:{port}")
    return candidates


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
    Try to reach the service on our mapped port AND the standard default port.
    Returns the URL that actually responded, normalised to localhost.
    Always returns JSON {found, url} — never raises.
    """
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Unknown service")

    cfg = SERVICES[service]
    default_url = f"http://localhost:{cfg['default_port']}"

    for base in _candidate_urls(cfg):
        if await _try_reach(base, cfg["detect_paths"]):
            # Normalise: always give back a localhost URL (works from browser)
            found_url = base.replace("host.docker.internal", "localhost")
            return {"found": True, "url": found_url}

    # Fallback: container exists in Docker? (socket may not be mounted — safe if not)
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


# ── Integration helpers ────────────────────────────────────────────────────────

async def _fetch_prowlarr_api_key(prowlarr_url: str) -> Optional[str]:
    """
    Try to read the Prowlarr API key from the unauthenticated initialize.js
    endpoint that all *arr apps expose.
    Returns None if not found (auth required or different version).
    """
    import re
    base = prowlarr_url.rstrip("/")
    async with _make_client(timeout=5.0) as client:
        for path in ["/initialize.js", "/prowlarr/initialize.js"]:
            try:
                r = await client.get(f"{base}{path}")
                if r.status_code == 200:
                    m = re.search(r'"apiKey"\s*:\s*"([a-f0-9]{32})"', r.text)
                    if m:
                        return m.group(1)
            except Exception:
                continue
    return None


async def _add_qbit_to_prowlarr(
    prowlarr_url: str, api_key: str,
    qbit_url: str, username: Optional[str], password: Optional[str],
) -> str:
    """
    Add qBittorrent as a download client in Prowlarr.
    Returns 'ok', 'already_exists', or an error message.
    """
    from urllib.parse import urlparse
    base = prowlarr_url.rstrip("/")
    headers = {"X-Api-Key": api_key, "Content-Type": "application/json"}

    parsed = urlparse(qbit_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 8080)
    use_ssl = parsed.scheme == "https"
    url_base = parsed.path.rstrip("/") if parsed.path not in ("", "/") else ""

    async with _make_client(timeout=10.0) as client:
        try:
            # Check existing clients
            r = await client.get(f"{base}/api/v1/downloadclient", headers=headers)
            if r.status_code == 200:
                existing = r.json()
                if any(d.get("implementation") == "QBittorrent" for d in existing):
                    return "already_exists"

            # Add download client
            payload = {
                "enable": True,
                "name": "qBittorrent",
                "implementation": "QBittorrent",
                "implementationName": "qBittorrent",
                "configContract": "QBittorrentSettings",
                "protocol": "torrent",
                "priority": 1,
                "tags": [],
                "fields": [
                    {"name": "host", "value": host},
                    {"name": "port", "value": port},
                    {"name": "useSsl", "value": use_ssl},
                    {"name": "urlBase", "value": url_base},
                    {"name": "username", "value": username or ""},
                    {"name": "password", "value": password or ""},
                    {"name": "category", "value": "prowlarr"},
                    {"name": "recentMoviePriority", "value": 0},
                    {"name": "olderMoviePriority", "value": 0},
                    {"name": "initialState", "value": 0},
                    {"name": "sequentialOrder", "value": False},
                    {"name": "firstAndLast", "value": False},
                ],
            }
            r2 = await client.post(f"{base}/api/v1/downloadclient", json=payload, headers=headers)
            if r2.status_code in (200, 201):
                return "ok"
            return f"http_{r2.status_code}"
        except Exception as exc:
            return f"error: {exc}"


class IntegrateRequest(BaseModel):
    prowlarr_url: Optional[str] = None
    prowlarr_api_key: Optional[str] = None   # user-supplied; skip auto-fetch if set
    qbittorrent_url: Optional[str] = None
    qbittorrent_username: Optional[str] = None
    qbittorrent_password: Optional[str] = None
    jellyfin_url: Optional[str] = None
    jellyfin_api_key: Optional[str] = None


@router.post("/integrate")
async def integrate_services(body: IntegrateRequest):
    """
    One-shot auto-integration:
      1. Discover Prowlarr API key via initialize.js (if not supplied)
      2. Register qBittorrent as Prowlarr download client
      3. Persist all URLs / credentials / API keys to settings
    Returns a results dict — never raises (failures are reported, not thrown).
    """
    from app.api.routes.settings import _write_env

    results: dict = {}

    # ── 1. Prowlarr API key ───────────────────────────────────────────────────
    prowlarr_api_key = body.prowlarr_api_key
    if body.prowlarr_url and not prowlarr_api_key:
        prowlarr_api_key = await _fetch_prowlarr_api_key(body.prowlarr_url)
        results["prowlarr_api_key"] = "discovered" if prowlarr_api_key else "not_found — enter manually in Settings → Prowlarr"
    elif prowlarr_api_key:
        results["prowlarr_api_key"] = "provided"

    # ── 2. Register qBittorrent in Prowlarr ───────────────────────────────────
    if body.prowlarr_url and prowlarr_api_key and body.qbittorrent_url:
        status = await _add_qbit_to_prowlarr(
            body.prowlarr_url, prowlarr_api_key,
            body.qbittorrent_url, body.qbittorrent_username, body.qbittorrent_password,
        )
        results["prowlarr_download_client"] = status
    elif body.prowlarr_url and not prowlarr_api_key:
        results["prowlarr_download_client"] = "skipped — API key required"

    # ── 3. Persist settings ───────────────────────────────────────────────────
    updates: dict = {}
    if body.prowlarr_url:
        updates["PROWLARR_URL"] = body.prowlarr_url
    if prowlarr_api_key:
        updates["PROWLARR_API_KEY"] = prowlarr_api_key
    if body.qbittorrent_url:
        updates["QBITTORRENT_URL"] = body.qbittorrent_url
    if body.qbittorrent_username:
        updates["QBITTORRENT_USERNAME"] = body.qbittorrent_username
    if body.qbittorrent_password:
        updates["QBITTORRENT_PASSWORD"] = body.qbittorrent_password
    if body.jellyfin_url:
        updates["JELLYFIN_URL"] = body.jellyfin_url
    if body.jellyfin_api_key:
        updates["JELLYFIN_API_KEY"] = body.jellyfin_api_key
    if updates:
        try:
            _write_env(updates)
            results["settings_saved"] = list(updates.keys())
        except Exception as exc:
            results["settings_error"] = str(exc)

    return {"status": "done", "results": results}


class ValidateRequest(BaseModel):
    url: str
    username: Optional[str] = None
    password: Optional[str] = None


@router.post("/validate/{service}")
async def validate_service(service: str, body: ValidateRequest):
    """
    Test connectivity to a user-provided URL.
    Strategy:
      - Try the given URL directly.
      - If that fails to connect, also try host.docker.internal substitution.
      - Any HTTP response (even 5xx) means the service is running.
      - qBittorrent: also verify credentials via login API.
    """
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Unknown service")

    cfg = SERVICES[service]
    url = body.url.rstrip("/")

    # Build list of URLs to try: user's URL first, then host.docker.internal variant
    urls_to_try = [url]
    if "localhost" in url:
        urls_to_try.append(url.replace("localhost", "host.docker.internal"))

    last_error = "Cannot connect — check URL and port"

    for try_url in urls_to_try:
        try:
            async with _make_client(timeout=8.0) as client:
                if service == "qbittorrent" and body.username:
                    resp = await client.post(
                        f"{try_url}/api/v2/auth/login",
                        data={"username": body.username, "password": body.password or ""},
                    )
                    if resp.text.strip() == "Ok.":
                        return {"connected": True, "url": url}
                    # Wrong credentials — no point trying other URL
                    return {"connected": False, "error": f"Login failed (got: {resp.text.strip()[:60]!r})"}
                else:
                    # Any HTTP response = service is reachable
                    for path in cfg["detect_paths"]:
                        try:
                            r = await client.get(f"{try_url}{path}")
                            status = r.status_code
                            if status < 500:
                                return {"connected": True, "url": url}
                            # 5xx — service is up but has an error; still consider connected
                            return {"connected": True, "url": url, "warning": f"Service responded with HTTP {status} — it may need configuration"}
                        except Exception:
                            continue
                    last_error = "Service unreachable on all paths — check URL"

        except httpx.ConnectError:
            last_error = f"Cannot connect to {try_url} — check URL and port"
            continue   # try host.docker.internal variant
        except httpx.TimeoutException:
            last_error = "Connection timed out — check URL and firewall"
            continue
        except Exception as exc:
            last_error = str(exc)
            continue

    return {"connected": False, "error": last_error}
