"""Chat API endpoints for RAG-powered regulations inquiry and session history."""
import logging
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from app.db.repositories.chat_repo import ChatRepository
from app.models.chat_model import ChatHistoryResponse, ChatRequest, ChatResponse
from app.services.ai.rag_pipeline import rag_pipeline

logger = logging.getLogger(__name__)

router = APIRouter()
chat_repo = ChatRepository()


@router.post(
    "/stream",
    summary="Hỏi đáp quy chế dạng Server-Sent Events (SSE)",
    description="Stream trực tiếp câu trả lời từng token kèm sự kiện trích dẫn nguồn văn bản (sources).",
)
async def chat_stream_endpoint(request: ChatRequest) -> StreamingResponse:
    """Stream response tokens using Server-Sent Events (SSE).

    Args:
        request: ChatRequest payload containing session_id, question, and top_k.

    Returns:
        StreamingResponse: SSE stream formatted with event and data lines.
    """
    try:
        event_generator = rag_pipeline.query_stream(
            session_id=request.session_id,
            question=request.question,
            top_k=request.top_k,
        )

        headers = {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }

        return StreamingResponse(
            event_generator,
            media_type="text/event-stream",
            headers=headers,
        )
    except Exception as exc:
        logger.error("Error in chat stream endpoint: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xử lý hội thoại streaming: {str(exc)}",
        ) from exc


@router.post(
    "/message",
    response_model=ChatResponse,
    summary="Hỏi đáp quy chế trả lời một lần (Non-streaming)",
    description="Xử lý toàn bộ quy trình RAG và trả về câu trả lời hoàn chỉnh kèm danh mục trích dẫn.",
)
async def chat_message_endpoint(request: ChatRequest) -> ChatResponse:
    """Non-streaming chat endpoint returning a complete synthesized answer.

    Args:
        request: ChatRequest payload.

    Returns:
        ChatResponse: Structured response including session_id, answer, and sources.
    """
    try:
        response = await rag_pipeline.query(
            session_id=request.session_id,
            question=request.question,
            top_k=request.top_k,
        )
        return response
    except Exception as exc:
        logger.error("Error in chat message endpoint: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xử lý hội thoại: {str(exc)}",
        ) from exc


@router.get(
    "/history/{session_id}",
    response_model=ChatHistoryResponse,
    summary="Lấy lịch sử hội thoại của một phiên",
    description="Truy xuất toàn bộ danh sách câu hỏi và câu trả lời trong phiên chat theo thứ tự thời gian.",
)
async def get_chat_history(session_id: str) -> ChatHistoryResponse:
    """Retrieve chronological chat history for the given session.

    Args:
        session_id: Conversation session identifier.

    Returns:
        ChatHistoryResponse: Session ID and list of past messages.
    """
    try:
        messages = await chat_repo.get_history(session_id=session_id, limit=50)
        return ChatHistoryResponse(
            session_id=session_id,
            total_messages=len(messages),
            messages=messages,
        )
    except Exception as exc:
        logger.error("Error fetching history for session %s: %s", session_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi truy xuất lịch sử phiên chat: {str(exc)}",
        ) from exc


@router.delete(
    "/history/{session_id}",
    summary="Xóa lịch sử hội thoại của một phiên",
    description="Xóa toàn bộ các tin nhắn đã lưu thuộc phiên chat tương ứng.",
)
async def clear_chat_history(session_id: str) -> Dict[str, Any]:
    """Clear all chat messages associated with a session ID.

    Args:
        session_id: Target session identifier.

    Returns:
        Dict[str, Any]: Operation status report.
    """
    try:
        success = await chat_repo.clear_history(session_id=session_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể xóa lịch sử phiên chat.",
            )
        return {
            "status": "success",
            "message": f"Đã xóa toàn bộ lịch sử của phiên {session_id}.",
            "session_id": session_id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error clearing history for session %s: %s", session_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xóa lịch sử phiên: {str(exc)}",
        ) from exc
