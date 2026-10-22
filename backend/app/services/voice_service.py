"""Voice processing service for Speech-to-Text (STT) and Text-to-Speech (TTS)."""
import logging
from typing import Any, Dict, Optional
from google import genai
from google.genai import types
from app.core.config import settings
from app.core.key_manager import key_manager

logger = logging.getLogger(__name__)


class VoiceService:
    """Service handling audio transcription and speech synthesis."""

    def __init__(self, model: str = settings.LLM_MODEL) -> None:
        self.model = model

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
    ) -> str:
        """Transcribe speech in Vietnamese from audio data using Gemini multimodal capabilities.

        Args:
            audio_bytes: Raw binary audio payload.
            mime_type: MIME type of the recorded audio (e.g., 'audio/webm', 'audio/wav', 'audio/mp3').

        Returns:
            str: Transcribed text string in Vietnamese.
        """
        if not audio_bytes:
            raise ValueError("Audio data is empty.")

        max_retries = max(key_manager.total_keys, 3)
        last_error: Optional[Exception] = None

        prompt = (
            "Bạn là chuyên gia nhận dạng giọng nói tiếng Việt. "
            "Hãy chuyển đổi chính xác lời nói tiếng Việt trong đoạn âm thanh này thành văn bản thuần túy. "
            "Giữ đúng dấu câu và câu hỏi. Chỉ trả về nội dung đã nói, không kèm theo bất kỳ lời chào, bình luận hay nhãn nào."
        )

        for attempt in range(max_retries):
            api_key = key_manager.get_next_key()
            try:
                client = genai.Client(api_key=api_key)
                audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)

                response = await client.aio.models.generate_content(
                    model=self.model,
                    contents=[audio_part, prompt],
                )

                transcribed_text = response.text or ""
                cleaned = transcribed_text.strip()
                logger.info("Successfully transcribed audio: %s", cleaned)
                return cleaned

            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Speech transcription failed with key ...%s on attempt %d: %s",
                    api_key[-6:] if len(api_key) >= 6 else "***",
                    attempt + 1,
                    exc,
                )

        logger.error("Failed to transcribe audio after %d attempts: %s", max_retries, last_error)
        raise RuntimeError(f"Audio transcription service failed: {last_error}") from last_error

    async def synthesize_speech_info(self, text: str) -> Dict[str, Any]:
        """Prepare speech synthesis metadata for frontend client playback.

        Args:
            text: Text to be vocalized.

        Returns:
            Dict[str, Any]: Synthesis instructions and config for Web Speech API.
        """
        clean_text = text.strip()
        return {
            "text": clean_text,
            "lang": "vi-VN",
            "rate": 1.0,
            "pitch": 1.0,
            "engine": "web_speech_api",
        }


# Singleton instance
voice_service: VoiceService = VoiceService()
