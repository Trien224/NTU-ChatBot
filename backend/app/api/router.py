"""Central API router aggregating versioned endpoints."""
from fastapi import APIRouter
from app.api.v1 import chat, document, voice

api_router = APIRouter(prefix="/api/v1")

# Mount Version 1 domain routers
api_router.include_router(chat.router, prefix="/chat", tags=["Chat & RAG"])
api_router.include_router(document.router, prefix="/documents", tags=["Documents & Ingestion"])
api_router.include_router(voice.router, prefix="/voice", tags=["Voice STT/TTS"])
