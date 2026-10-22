"""Service layer package."""
from app.services.ocr_service import OCRService, ocr_service
from app.services.voice_service import VoiceService, voice_service

__all__ = ["OCRService", "ocr_service", "VoiceService", "voice_service"]
