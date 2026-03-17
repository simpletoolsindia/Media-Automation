from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # ── AI Provider ────────────────────────────────────────────────────────────
    # Supported: anthropic | openai | ollama | lmstudio | deepseek | openrouter
    ai_provider: str = "anthropic"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-6"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    openai_base_url: str = "https://api.openai.com/v1"

    # Ollama (local, no key needed)
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # LM Studio (local, no key needed)
    lmstudio_url: str = "http://localhost:1234/v1"
    lmstudio_model: str = "local-model"

    # DeepSeek
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com/v1"

    # OpenRouter
    openrouter_api_key: str = ""
    openrouter_model: str = "anthropic/claude-3.5-sonnet"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # ── Database (PostgreSQL always) ───────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://media:media@postgres:5432/media_organizor"
    database_url_sync: str = "postgresql://media:media@postgres:5432/media_organizor"

    # ── Media Paths ────────────────────────────────────────────────────────────
    media_root: str = "/media"
    downloads_path: str = "/downloads"

    # ── Search (Prowlarr) ──────────────────────────────────────────────────────
    prowlarr_url: str = "http://prowlarr:9696"
    prowlarr_api_key: str = ""

    # ── Download Client (qBittorrent) ──────────────────────────────────────────
    qbittorrent_url: str = "http://qbittorrent:8080"
    qbittorrent_username: str = "admin"
    qbittorrent_password: str = "adminadmin"
    qbittorrent_use_existing: bool = False   # True = user-provided external instance

    # ── Metadata (TMDB) ───────────────────────────────────────────────────────
    tmdb_api_key: str = ""

    # ── Jellyfin ──────────────────────────────────────────────────────────────
    jellyfin_url: str = "http://jellyfin:8096"
    jellyfin_api_key: str = ""

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = "redis://redis:6379/0"

    # ── App ───────────────────────────────────────────────────────────────────
    secret_key: str = "change_me_in_production"
    debug: bool = False
    setup_complete: bool = False

    class Config:
        # Load defaults from .env (dev), then runtime overrides from /app/data/settings.env
        env_file = [".env", "/app/data/settings.env"]
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
