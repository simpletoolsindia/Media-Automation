"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db
from app.api.routes import media, downloads, organizer, settings, agent, services


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Media Organizor",
    description="AI-powered media management platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(media.router)
app.include_router(downloads.router)
app.include_router(organizer.router)
app.include_router(settings.router)
app.include_router(agent.router)
app.include_router(services.router)


@app.get("/")
async def root():
    return {"message": "Media Organizor API", "docs": "/docs"}
