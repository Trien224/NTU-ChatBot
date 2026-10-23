"""Chat API endpoints for RAG-powered regulations inquiry and session history."""
import logging
from typing import Any, Dict, List, Optional
import html
from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from app.db.repositories.chat_repo import ChatRepository
from app.models.chat_model import (
    ChatHistoryResponse,
    ChatRequest,
    ChatResponse,
    SessionListResponse,
    SessionMetadata,
    SessionUpdateRequest,
)
from app.services.ai.rag_pipeline import rag_pipeline

logger = logging.getLogger(__name__)

router = APIRouter()
chat_repo = ChatRepository()


@router.get(
    "/sessions",
    response_model=SessionListResponse,
    summary="Lấy danh sách các cuộc trò chuyện",
    description="Truy xuất danh sách lịch sử hội thoại, ưu tiên các phiên được Ghim (is_pinned: True) lên trước. Hỗ trợ lọc theo student_id.",
)
async def list_chat_sessions(
    limit: int = 50,
    student_id: Optional[str] = Query(None, description="Mã số sinh viên để lọc lịch sử riêng"),
) -> SessionListResponse:
    """Retrieve all available chat sessions ordered by pinned status and updated_at."""
    try:
        sessions = await chat_repo.list_sessions(limit=limit, student_id=student_id)
        return SessionListResponse(total_sessions=len(sessions), sessions=sessions)
    except Exception as exc:
        logger.error("Error listing chat sessions: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lấy danh sách cuộc trò chuyện: {str(exc)}",
        ) from exc


@router.patch(
    "/sessions/{session_id}",
    response_model=SessionMetadata,
    summary="Đổi tên hoặc ghim/bỏ ghim cuộc trò chuyện",
    description="Cập nhật tiêu đề hiển thị hoặc trạng thái Ghim của một phiên chat cụ thể.",
)
async def update_chat_session(session_id: str, request: SessionUpdateRequest) -> SessionMetadata:
    """Update title or pinned status of a session."""
    try:
        updated = await chat_repo.update_session(
            session_id=session_id,
            title=request.title,
            is_pinned=request.is_pinned,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy phiên trò chuyện {session_id}.",
            )
        return updated
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error updating session %s: %s", session_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi cập nhật phiên trò chuyện: {str(exc)}",
        ) from exc


@router.get(
    "/sessions/{session_id}/export-word",
    summary="Xuất toàn bộ nội dung cuộc trò chuyện thành file Word (.doc)",
    description="Tạo và tải về file Microsoft Word (.doc) chứa toàn bộ câu hỏi, câu trả lời và bảng trích dẫn căn cứ pháp lý.",
)
async def export_session_word(session_id: str) -> Response:
    """Export complete session conversation into standard Microsoft Word (.doc) document."""
    try:
        messages = await chat_repo.get_history(session_id=session_id, limit=200)
        session_info = await chat_repo.get_session(session_id)
        session_title = session_info.title if session_info else "Tư vấn Quy chế Học vụ NTU"
        created_time = session_info.created_at.strftime("%d/%m/%Y %H:%M") if session_info else "Hôm nay"

        # Build Q&A HTML content
        qa_html_parts = []
        turn_index = 1
        i = 0
        while i < len(messages):
            msg = messages[i]
            if msg.role == "user":
                q_text = html.escape(msg.content).replace("\n", "<br>")
                q_time = msg.timestamp.strftime("%H:%M - %d/%m/%Y")

                # Find matching assistant reply if available
                a_text = ""
                a_sources = []
                if i + 1 < len(messages) and messages[i + 1].role == "assistant":
                    a_msg = messages[i + 1]
                    a_text = html.escape(a_msg.content).replace("\n", "<br>")
                    a_sources = a_msg.sources or []
                    i += 1  # Skip paired assistant message
                else:
                    a_text = "<em>(Đang chờ phản hồi...)</em>"

                # Build citations table if sources exist
                sources_table_html = ""
                if a_sources:
                    rows_html = []
                    for s_idx, s in enumerate(a_sources, start=1):
                        doc_t = html.escape(str(s.get("title") or s.get("doc_title") or "Quy chế Đào tạo NTU"))
                        art = html.escape(str(s.get("article") or "-"))
                        clause = html.escape(str(s.get("clause") or "-"))
                        score_val = s.get("score")
                        score_pct = f"{round(float(score_val) * 100, 1)}%" if score_val else "Cao"
                        rows_html.append(
                            f"<tr>"
                            f"<td align='center'>{s_idx}</td>"
                            f"<td><strong>{art}</strong> ({clause})</td>"
                            f"<td>{doc_t}</td>"
                            f"<td align='center'>{score_pct}</td>"
                            f"</tr>"
                        )

                    sources_table_html = (
                        f"<div style='margin-top:10px; font-weight:bold; color:#1e3a8a;'>📚 Căn cứ pháp lý trích dẫn:</div>"
                        f"<table class='sources-table'>"
                        f"<thead><tr>"
                        f"<th width='6%'>STT</th>"
                        f"<th width='34%'>Điều / Khoản</th>"
                        f"<th width='45%'>Văn bản Quy chế</th>"
                        f"<th width='15%'>Độ tin cậy</th>"
                        f"</tr></thead>"
                        f"<tbody>{''.join(rows_html)}</tbody>"
                        f"</table>"
                    )

                qa_html_parts.append(
                    f"<div class='qa-turn'>"
                    f"<div class='question-title'>Câu hỏi #{turn_index} <span style='font-size:10pt; font-weight:normal; color:#64748b;'>({q_time})</span>:</div>"
                    f"<div class='question-content'>{q_text}</div>"
                    f"<div class='answer-title'>🤖 Trả lời từ NTU EduBot:</div>"
                    f"<div class='answer-content'>{a_text}</div>"
                    f"{sources_table_html}"
                    f"</div>"
                )
                turn_index += 1
            i += 1

        if not qa_html_parts:
            qa_html_parts.append("<p style='text-align:center; font-style:italic;'>Phiên hội thoại này chưa có tin nhắn nào được ghi nhận.</p>")

        word_document_content = f"""<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>NTU EduBot - Biên bản tư vấn học vụ</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page {{
    size: 21.0cm 29.7cm; /* A4 size */
    margin: 2.0cm 2.0cm 2.0cm 2.5cm;
    mso-page-orientation: portrait;
}}
body {{
    font-family: 'Times New Roman', Times, serif;
    font-size: 13pt;
    line-height: 1.45;
    color: #0f172a;
}}
.header-table {{ width: 100%; border: none; margin-bottom: 20px; }}
.header-table td {{ border: none; vertical-align: top; text-align: center; font-size: 11.5pt; }}
.motto {{ font-weight: bold; text-transform: uppercase; font-size: 11pt; }}
.sub-motto {{ font-style: italic; font-weight: bold; font-size: 11pt; }}
.hr-line {{ width: 140px; height: 1.5px; background-color: #000; margin: 4px auto; }}
.doc-title {{ font-size: 16pt; font-weight: bold; text-align: center; color: #1e3a8a; margin: 25px 0 6px 0; text-transform: uppercase; }}
.doc-subtitle {{ font-size: 12pt; font-style: italic; text-align: center; margin-bottom: 25px; color: #475569; }}
.meta-box {{ background-color: #f8fafc; border: 1.5px solid #cbd5e1; padding: 12px 18px; margin-bottom: 25px; font-size: 11.5pt; line-height: 1.6; }}
.qa-turn {{ margin-bottom: 30px; page-break-inside: avoid; border-bottom: 1px dashed #cbd5e1; padding-bottom: 20px; }}
.question-title {{ font-size: 12.5pt; font-weight: bold; color: #0f172a; margin-bottom: 6px; }}
.question-content {{ background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 10px 14px; font-size: 12.5pt; margin-bottom: 12px; font-style: italic; }}
.answer-title {{ font-size: 12.5pt; font-weight: bold; color: #1e3a8a; margin-bottom: 6px; }}
.answer-content {{ padding: 6px 14px; line-height: 1.55; font-size: 12.5pt; }}
.sources-table {{ width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10.5pt; }}
.sources-table th, .sources-table td {{ border: 1px solid #94a3b8; padding: 6px 10px; text-align: left; }}
.sources-table th {{ background-color: #e2e8f0; font-weight: bold; text-align: center; }}
.footer-note {{ font-size: 10pt; font-style: italic; color: #64748b; border-top: 1px solid #cbd5e1; margin-top: 40px; padding-top: 12px; text-align: center; }}
</style>
</head>
<body>

<table class='header-table'>
<tr>
    <td width='50%'>
        <strong>TRƯỜNG ĐẠI HỌC NGUYỄN TRÃI</strong><br>
        <strong>TRỢ LÝ AI HỌC VỤ NTU EDUBOT</strong><br>
        <div class='hr-line'></div>
    </td>
    <td width='50%'>
        <span class='motto'>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</span><br>
        <span class='sub-motto'>Độc lập - Tự do - Hạnh phúc</span><br>
        <div class='hr-line'></div>
    </td>
</tr>
</table>

<div class='doc-title'>BIÊN BẢN TƯ VẤN & TRA CỨU QUY CHẾ HỌC VỤ</div>
<div class='doc-subtitle'>(Trích xuất tự động từ Hệ thống Trợ lý ảo AI NTU EduBot)</div>

<div class='meta-box'>
    <strong>• Chủ đề / Tiêu đề phiên:</strong> {html.escape(session_title)}<br>
    <strong>• Mã phiên hội thoại (Session ID):</strong> <code>{html.escape(session_id)}</code><br>
    <strong>• Thời điểm khởi tạo:</strong> {created_time}<br>
    <strong>• Tổng số lượt tương tác:</strong> {len(messages)} tin nhắn ({turn_index - 1} câu hỏi & trả lời)
</div>

<div style='margin-bottom: 20px; font-weight: bold; font-size: 13pt; color: #1e3a8a;'>
    NỘI DUNG CHI TIẾT CÁC LƯỢT TRA CỨU:
</div>

{''.join(qa_html_parts)}

<div class='footer-note'>
    Văn bản được trích xuất tự động từ Hệ thống AI Tra cứu Quy chế Học vụ NTU EduBot - Trường Đại học Nguyễn Trãi.<br>
    Thông tin tra cứu có giá trị tham khảo học vụ theo Quy chế Đào tạo hiện hành của Nhà trường.
</div>

</body>
</html>"""

        clean_filename = f"NTU_EduBot_TuVanHocVu_{session_id[:12]}.doc"
        return Response(
            content=word_document_content.encode("utf-8"),
            media_type="application/msword; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{clean_filename}"',
                "Content-Type": "application/msword; charset=utf-8",
            },
        )
    except Exception as exc:
        logger.error("Error exporting Word document for session %s: %s", session_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xuất file Word: {str(exc)}",
        ) from exc





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


@router.delete(
    "/sessions/all",
    summary="Xóa toàn bộ lịch sử hội thoại cá nhân",
    description="Xóa toàn bộ các phiên trò chuyện và tin nhắn, hỗ trợ lọc theo student_id nếu được truyền.",
)
async def clear_all_chat_sessions(
    student_id: Optional[str] = Query(None, description="Mã số sinh viên (tùy chọn)"),
) -> Dict[str, Any]:
    """Delete all chat sessions and messages for a student (or all sessions if not specified)."""
    try:
        deleted = await chat_repo.clear_all_sessions(student_id=student_id)
        return {
            "status": "success",
            "message": f"Đã xóa thành công {deleted} cuộc trò chuyện.",
            "deleted_count": deleted,
            "student_id": student_id,
        }
    except Exception as exc:
        logger.error("Error clearing all sessions: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xóa toàn bộ lịch sử: {str(exc)}",
        ) from exc
