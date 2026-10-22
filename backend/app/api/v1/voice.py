"""Voice processing API endpoints for speech-to-text transcription and audio configurations."""
import logging
from typing import Any, Dict
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from app.services.voice_service import voice_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/transcribe",
    summary="Chuyển đổi giọng nói thành văn bản (Speech-to-Text)",
    description="Nhận tệp âm thanh ghi âm từ microphone người dùng (WebM, WAV, MP3, OGG) và chuyển hóa thành văn bản tiếng Việt.",
)
async def transcribe_audio_endpoint(
    audio: UploadFile = File(..., description="Tệp âm thanh ghi âm từ trình duyệt"),
) -> Dict[str, Any]:
    """Transcribe recorded speech into Vietnamese text.

    Args:
        audio: Uploaded audio binary file.

    Returns:
        Dict[str, Any]: Transcribed text and processing status.
    """
    if not audio.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp âm thanh không hợp lệ.",
        )

    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dữ liệu âm thanh rỗng.",
            )

        mime_type = audio.content_type or "audio/webm"
        # Sanitize mime_type if generic octet-stream
        if mime_type == "application/octet-stream":
            ext = audio.filename.split(".")[-1].lower() if "." in audio.filename else "webm"
            mime_type = f"audio/{ext}"

        logger.info("Transcribing audio file '%s' (%s, %d bytes)", audio.filename, mime_type, len(audio_bytes))
        transcribed_text = await voice_service.transcribe_audio(
            audio_bytes=audio_bytes,
            mime_type=mime_type,
        )

        return {
            "text": transcribed_text,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in audio transcription endpoint: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi nhận diện giọng nói: {str(exc)}",
        ) from exc


@router.get(
    "/config",
    summary="Lấy cấu hình phát âm thanh tiếng Việt",
    description="Cung cấp các thông số ngôn ngữ và tham số phát âm thanh (Web Speech API) cho phía Frontend.",
)
async def get_voice_config() -> Dict[str, Any]:
    """Retrieve Vietnamese voice synthesis parameters for the web client."""
    try:
        config = await voice_service.synthesize_speech_info(text="")
        return config
    except Exception as exc:
        logger.error("Error retrieving voice config: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lấy thông số âm thanh: {str(exc)}",
        ) from exc
