# Media Organizor

> AI-powered media management platform — replaces Sonarr + Radarr + Prowlarr + Overseerr

## Quick Start (Docker Hub)

```bash
# 1. Create a directory
mkdir media-organizor && cd media-organizor

# 2. Download docker-compose
curl -O https://raw.githubusercontent.com/simpletoolsindia/Media-Automation/main/docker-compose.yml

# 3. Start (core services only)
docker compose up -d

# 4. Open browser
open http://localhost:3000
```

The setup wizard will guide you through configuration.

## Full Stack (with Prowlarr, qBittorrent, Jellyfin)

```bash
docker compose --profile full up -d
```

## Supported AI Providers

| Provider | Type | Requires Key |
|---|---|---|
| Anthropic Claude | Cloud | Yes |
| OpenAI | Cloud | Yes |
| DeepSeek | Cloud | Yes |
| OpenRouter | Cloud | Yes |
| Ollama | Local | No |
| LM Studio | Local | No |

## Architecture

```
User → Next.js UI → FastAPI Backend → AI Agent (Claude/GPT/Local)
                                    → Prowlarr (Search)
                                    → qBittorrent (Download)
                                    → TMDB (Metadata)
                                    → Jellyfin (Library)
```

## Build from Source

```bash
git clone https://github.com/simpletoolsindia/Media-Automation.git
cd Media-Automation
docker compose up --build -d
```

## Docker Hub

```bash
docker pull simpletoolsindia/media-organizor-backend:latest
docker pull simpletoolsindia/media-organizor-frontend:latest
```
