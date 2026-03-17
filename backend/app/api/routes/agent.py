"""Agent chat endpoints."""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.agents.orchestrator import OrchestratorAgent

router = APIRouter(prefix="/api/agent", tags=["agent"])

# Simple in-memory agent (in production, use session-based agents)
_agent = OrchestratorAgent()


class ChatMessage(BaseModel):
    message: str


class ResetRequest(BaseModel):
    pass


@router.post("/chat")
async def chat(body: ChatMessage):
    """Stream chat response from the AI agent."""
    async def generate():
        async for chunk in _agent.chat(body.message):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/reset")
async def reset_conversation():
    """Reset the agent's conversation history."""
    _agent.reset()
    return {"status": "ok", "message": "Conversation reset"}
