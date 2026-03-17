"""Multi-LLM provider abstraction layer.

Supports: anthropic | openai | ollama | lmstudio | deepseek | openrouter
"""
from __future__ import annotations
import json
from typing import AsyncGenerator, Any
from app.config import get_settings

settings = get_settings()


def _get_active_provider() -> str:
    """Re-read settings to get live provider (not cached)."""
    from app.config import Settings
    s = Settings()
    return s.ai_provider


def _get_openai_client(provider: str):
    """Build an openai-compatible async client for a given provider."""
    from openai import AsyncOpenAI
    from app.config import Settings
    s = Settings()

    if provider == "openai":
        return AsyncOpenAI(api_key=s.openai_api_key, base_url=s.openai_base_url)
    elif provider == "ollama":
        return AsyncOpenAI(api_key="ollama", base_url=f"{s.ollama_url}/v1")
    elif provider == "lmstudio":
        return AsyncOpenAI(api_key="lmstudio", base_url=s.lmstudio_url)
    elif provider == "deepseek":
        return AsyncOpenAI(api_key=s.deepseek_api_key, base_url=s.deepseek_base_url)
    elif provider == "openrouter":
        return AsyncOpenAI(
            api_key=s.openrouter_api_key,
            base_url=s.openrouter_base_url,
            default_headers={"HTTP-Referer": "https://media-organizor.app"},
        )
    raise ValueError(f"Unknown provider: {provider}")


def _get_model(provider: str) -> str:
    from app.config import Settings
    s = Settings()
    models = {
        "anthropic": s.anthropic_model,
        "openai": s.openai_model,
        "ollama": s.ollama_model,
        "lmstudio": s.lmstudio_model,
        "deepseek": s.deepseek_model,
        "openrouter": s.openrouter_model,
    }
    return models.get(provider, "gpt-4o")


SYSTEM_PROMPT = """You are an AI-powered media management assistant. You help users search, download, organize, and manage their media library.

You have access to these tools:
- search_media: Search for movies/TV shows across torrent indexers
- rank_results: Rank search results by quality and seeders
- download_media: Send torrents to the download client
- track_download: Check download progress
- organize_files: Rename and move files to Jellyfin structure
- fetch_metadata: Get metadata from TMDB
- sync_jellyfin: Trigger Jellyfin library scan
- llm_disambiguation: Ask user to clarify ambiguous requests

Workflow: search_media → rank_results → download_media → (when done) organize_files → fetch_metadata → sync_jellyfin

Always prefer 1080p unless user specifies. Be concise and report each step.
Confirm title with user if there's ambiguity before downloading."""


# ── OpenAI-compatible tool definitions ────────────────────────────────────────
OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_media",
            "description": "Search for movies or TV shows across configured indexers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "media_type": {"type": "string", "enum": ["movie", "tv", "auto"]},
                    "year": {"type": "string"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "rank_results",
            "description": "Rank and filter search results.",
            "parameters": {
                "type": "object",
                "properties": {
                    "results": {"type": "array", "items": {"type": "object"}},
                    "preferred_quality": {"type": "string", "enum": ["1080p", "720p", "4K", "any"]},
                },
                "required": ["results"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "download_media",
            "description": "Send a torrent to qBittorrent for downloading.",
            "parameters": {
                "type": "object",
                "properties": {
                    "magnet": {"type": "string"},
                    "title": {"type": "string"},
                    "media_type": {"type": "string", "enum": ["movie", "tv"]},
                },
                "required": ["magnet", "title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "track_download",
            "description": "Check download status.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "organize_files",
            "description": "Organize media files into Jellyfin structure.",
            "parameters": {
                "type": "object",
                "properties": {
                    "input_path": {"type": "string"},
                    "dry_run": {"type": "boolean"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_metadata",
            "description": "Fetch metadata from TMDB.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "year": {"type": "string"},
                    "media_type": {"type": "string", "enum": ["movie", "tv"]},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "sync_jellyfin",
            "description": "Trigger a Jellyfin library scan.",
            "parameters": {
                "type": "object",
                "properties": {"library": {"type": "string"}},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "llm_disambiguation",
            "description": "Ask user to clarify which media they want.",
            "parameters": {
                "type": "object",
                "properties": {
                    "options": {"type": "array", "items": {"type": "object"}},
                    "question": {"type": "string"},
                },
                "required": ["options", "question"],
            },
        },
    },
]


class AIProvider:
    """Unified async streaming interface over multiple LLM backends."""

    def __init__(self):
        self.conversation_history: list[dict] = []

    def reset(self):
        self.conversation_history = []

    async def chat(self, user_message: str) -> AsyncGenerator[str, None]:
        provider = _get_active_provider()
        self.conversation_history.append({"role": "user", "content": user_message})

        if provider == "anthropic":
            async for chunk in self._chat_anthropic():
                yield chunk
        else:
            async for chunk in self._chat_openai(provider):
                yield chunk

    # ── Anthropic ─────────────────────────────────────────────────────────────
    async def _chat_anthropic(self) -> AsyncGenerator[str, None]:
        import anthropic as ant
        from app.agents.tools import TOOLS, execute_tool
        from app.config import Settings
        s = Settings()

        client = ant.AsyncAnthropic(api_key=s.anthropic_api_key)
        messages = [m for m in self.conversation_history]

        while True:
            response_text = ""
            async with client.messages.stream(
                model=s.anthropic_model,
                max_tokens=4096,
                thinking={"type": "adaptive"},
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_delta" and event.delta.type == "text_delta":
                        response_text += event.delta.text
                        yield event.delta.text
                final = await stream.get_final_message()

            tool_use_blocks = [b for b in final.content if b.type == "tool_use"]
            messages.append({"role": "assistant", "content": final.content})

            if final.stop_reason == "end_turn" or not tool_use_blocks:
                self.conversation_history.append({"role": "assistant", "content": response_text})
                break

            yield "\n"
            tool_results = []
            for tb in tool_use_blocks:
                yield f"\n⚙️ **{tb.name}...**\n"
                try:
                    result = await execute_tool(tb.name, tb.input)
                    tool_results.append({"type": "tool_result", "tool_use_id": tb.id, "content": result})
                except Exception as e:
                    tool_results.append({"type": "tool_result", "tool_use_id": tb.id, "content": json.dumps({"error": str(e)}), "is_error": True})
            messages.append({"role": "user", "content": tool_results})

    # ── OpenAI-compatible ─────────────────────────────────────────────────────
    async def _chat_openai(self, provider: str) -> AsyncGenerator[str, None]:
        from app.agents.tools import execute_tool

        client = _get_openai_client(provider)
        model = _get_model(provider)
        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + [
            {"role": m["role"], "content": m["content"] if isinstance(m["content"], str) else str(m["content"])}
            for m in self.conversation_history
        ]

        response_text = ""
        while True:
            stream = await client.chat.completions.create(
                model=model,
                messages=messages,
                tools=OPENAI_TOOLS,
                tool_choice="auto",
                stream=True,
            )

            tool_calls_accumulator: dict[int, dict] = {}
            current_text = ""

            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if not delta:
                    continue

                if delta.content:
                    current_text += delta.content
                    response_text += delta.content
                    yield delta.content

                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_accumulator:
                            tool_calls_accumulator[idx] = {
                                "id": tc.id or "",
                                "name": tc.function.name if tc.function else "",
                                "arguments": "",
                            }
                        if tc.id:
                            tool_calls_accumulator[idx]["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                tool_calls_accumulator[idx]["name"] = tc.function.name
                            if tc.function.arguments:
                                tool_calls_accumulator[idx]["arguments"] += tc.function.arguments

            if not tool_calls_accumulator:
                self.conversation_history.append({"role": "assistant", "content": response_text})
                break

            # Append assistant turn with tool calls
            tool_call_objs = []
            for idx, tc in tool_calls_accumulator.items():
                tool_call_objs.append({
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments"]},
                })
            messages.append({"role": "assistant", "content": current_text, "tool_calls": tool_call_objs})

            yield "\n"
            for tc in tool_call_objs:
                name = tc["function"]["name"]
                yield f"\n⚙️ **{name}...**\n"
                try:
                    args = json.loads(tc["function"]["arguments"] or "{}")
                    result = await execute_tool(name, args)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result,
                    })
                except Exception as e:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps({"error": str(e)}),
                    })
