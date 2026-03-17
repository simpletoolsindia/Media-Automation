"""AI Orchestrator — delegates to AIProvider for multi-LLM support."""
from typing import AsyncGenerator
from app.services.ai_provider import AIProvider

_provider = AIProvider()


class OrchestratorAgent:
    def __init__(self):
        self._provider = AIProvider()

    async def chat(self, user_message: str) -> AsyncGenerator[str, None]:
        async for chunk in self._provider.chat(user_message):
            yield chunk

    def reset(self):
        self._provider.reset()
