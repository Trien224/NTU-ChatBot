import asyncio
import logging
from typing import AsyncGenerator, List, Optional
from google import genai
from google.genai import types
from app.core.config import settings
from app.core.key_manager import key_manager
from app.models.chat_model import ChatMessage

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Bạn là NTU EduBot - Trợ lý ảo tư vấn Quy chế học vụ và Đào tạo chính thức của Trường Đại học Nguyễn Trãi (NTU).
Nhiệm vụ của bạn là giải đáp các thắc mắc về học chế tín chỉ, điểm rèn luyện, đăng ký học phần, học bổng, thi cử và các thủ tục hành chính sinh viên.

NGUYÊN TẮC HOẠT ĐỘNG BẮT BUỘC:
1. TRUNG THỰC & BÁM SÁT NGỮ CẢNH: CHỈ trả lời dựa trên thông tin được cung cấp trong phần "NGỮ CẢNH TRÍCH XUẤT". Tuyệt đối KHÔNG tự suy đoán, KHÔNG bịa đặt thông tin (zero hallucination).
2. DẪN CHỨNG PHÁP LÝ RÕ RÀNG: Luôn trích dẫn nguồn căn cứ cụ thể ở đầu hoặc cuối câu trả lời theo cú pháp chuẩn mực: "Căn cứ theo Điều... Khoản... Quy chế [Tên văn bản]...".
3. TRƯỜNG HỢP KHÔNG TÌM THẤY: Nếu ngữ cảnh trích xuất không có thông tin giải đáp câu hỏi, hãy lịch sự trả lời:
   "Xin lỗi bạn, tài liệu quy chế học vụ hiện hành của Trường Đại học Nguyễn Trãi trong cơ sở dữ liệu chưa có quy định chi tiết về câu hỏi này. Bạn vui lòng liên hệ trực tiếp Phòng Quản lý Đào tạo hoặc Ban Đào tạo & CTSV của Trường Đại học Nguyễn Trãi để được hỗ trợ giải quyết chính xác nhất."
4. PHONG CÁCH: Lịch sự, ân cần, súc tích, văn phong sư phạm chuẩn mực. Sử dụng định dạng Markdown, gạch đầu dòng rõ ràng để sinh viên dễ nắm bắt.
"""


def format_offline_fallback_response(context: str, prompt: str) -> str:
    """Synthesize structured response directly from retrieved regulations when Gemini API is unavailable."""
    if not context or "Không tìm thấy" in context:
        return (
            "Xin lỗi bạn, tài liệu quy chế học vụ hiện hành của Trường Đại học Nguyễn Trãi trong cơ sở dữ liệu chưa có quy định chi tiết về câu hỏi này.\n\n"
            "Bạn vui lòng liên hệ trực tiếp **Phòng Quản lý Đào tạo** hoặc **Ban Đào tạo & Công tác Sinh viên (CTSV)** của Trường Đại học Nguyễn Trãi để được hỗ trợ chính xác nhất:\n"
            "- **Địa chỉ**: Số 28A Lê Trọng Tấn, La Khê, Hà Đông, Hà Nội\n"
            "- **Hotline**: 0981.924.302 - 024.3312.0468\n"
            "- **Website**: [ntu.edu.vn](https://ntu.edu.vn)"
        )

    return (
        f"Căn cứ theo **Quy chế Đào tạo trình độ Đại học - Trường Đại học Nguyễn Trãi (NTU)**, nội dung quy định chi tiết giải đáp cho câu hỏi của bạn như sau:\n\n"
        f"{context}\n\n"
        f"---\n"
        f"*(💡 Phản hồi được trích xuất và tổng hợp trực tiếp từ Cơ sở dữ liệu Quy chế NTU qua cơ chế Smart Offline Fallback)*"
    )


class GeminiLLM:
    """Asynchronous interface for generating streaming and non-streaming answers via Gemini."""

    def __init__(self, model: str = settings.LLM_MODEL) -> None:
        self.model = model

    def _build_contents(
        self,
        prompt: str,
        context: str,
        history: Optional[List[ChatMessage]] = None,
    ) -> List[types.Content]:
        """Construct multimodal/chat Content structure with history and context."""
        contents: List[types.Content] = []

        # Append previous conversation history turns if provided
        if history:
            for msg in history:
                role = "model" if msg.role == "assistant" else "user"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=msg.content)],
                    )
                )

        # Assemble current prompt with grounding context
        user_turn_text = (
            f"NGỮ CẢNH TRÍCH XUẤT TỪ QUY CHẾ ĐẠI HỌC NGUYỄN TRÃI:\n"
            f"----------------------------------------\n"
            f"{context}\n"
            f"----------------------------------------\n\n"
            f"CÂU HỎI CỦA SINH VIÊN:\n"
            f"{prompt}"
        )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_turn_text)],
            )
        )

        return contents

    async def generate_stream(
        self,
        prompt: str,
        context: str,
        history: Optional[List[ChatMessage]] = None,
    ) -> AsyncGenerator[str, None]:
        """Generate response asynchronously in a streaming fashion with fast 2s timeout and failover.

        Tries gemini-2.5-flash first, then gemini-2.0-flash, and falls back immediately to
        Smart Offline Fallback within 2 seconds if any API issues occur, guaranteeing no stream hangs.
        """
        contents = self._build_contents(prompt=prompt, context=context, history=history)
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.2,
            top_p=0.95,
        )

        candidate_models = [self.model]
        if "gemini-2.0-flash" not in candidate_models:
            candidate_models.append("gemini-2.0-flash")

        has_usable_keys = key_manager.total_keys > 0 and not all(k.startswith("key_") for k in key_manager._keys)

        if has_usable_keys:
            for model_name in candidate_models:
                max_retries = min(max(key_manager.total_keys, 1), 2)
                for attempt in range(max_retries):
                    api_key = key_manager.get_next_key()
                    if api_key.startswith("key_"):
                        continue
                    try:
                        client = genai.Client(api_key=api_key)
                        # Acquire stream with 2.0s timeout to prevent stalling
                        response_stream = await asyncio.wait_for(
                            client.aio.models.generate_content_stream(
                                model=model_name,
                                contents=contents,
                                config=config,
                            ),
                            timeout=2.0,
                        )

                        stream_iter = response_stream.__aiter__()
                        # Verify first chunk arrival within 2.0s
                        try:
                            first_chunk = await asyncio.wait_for(stream_iter.__anext__(), timeout=2.0)
                            if first_chunk.text:
                                yield first_chunk.text
                        except StopAsyncIteration:
                            return

                        # Stream remaining chunks
                        async for chunk in stream_iter:
                            if chunk.text:
                                yield chunk.text

                        # Successfully finished streaming
                        return

                    except Exception as exc:
                        logger.warning(
                            "Streaming with model '%s' failed (attempt %d, key ...%s): %s",
                            model_name,
                            attempt + 1,
                            api_key[-6:] if len(api_key) >= 6 else "***",
                            exc,
                        )
                        # Immediately continue to next attempt or model without blocking

        # Smart Offline Fallback: Synthesize directly from retrieved context chunks
        logger.info("Activating Smart Offline Fallback for streaming generation")
        fallback_text = format_offline_fallback_response(context=context, prompt=prompt)

        # Stream words smoothly to emulate streaming behavior
        words = fallback_text.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == len(words) - 1 else word + " "
            yield chunk
            await asyncio.sleep(0.003)

    async def generate_answer(
        self,
        prompt: str,
        context: str,
        history: Optional[List[ChatMessage]] = None,
    ) -> str:
        """Generate non-streaming response with fast failover and Smart Offline Fallback."""
        contents = self._build_contents(prompt=prompt, context=context, history=history)
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.2,
            top_p=0.95,
        )

        candidate_models = [self.model]
        if "gemini-2.0-flash" not in candidate_models:
            candidate_models.append("gemini-2.0-flash")

        has_usable_keys = key_manager.total_keys > 0 and not all(k.startswith("key_") for k in key_manager._keys)

        if has_usable_keys:
            for model_name in candidate_models:
                max_retries = min(max(key_manager.total_keys, 1), 2)
                for attempt in range(max_retries):
                    api_key = key_manager.get_next_key()
                    if api_key.startswith("key_"):
                        continue
                    try:
                        client = genai.Client(api_key=api_key)
                        response = await asyncio.wait_for(
                            client.aio.models.generate_content(
                                model=model_name,
                                contents=contents,
                                config=config,
                            ),
                            timeout=2.0,
                        )
                        if response.text:
                            return response.text
                    except Exception as exc:
                        logger.warning(
                            "Non-streaming with model '%s' failed (attempt %d): %s",
                            model_name,
                            attempt + 1,
                            exc,
                        )

        # Smart Offline Fallback
        logger.info("Activating Smart Offline Fallback for non-streaming answer")
        return format_offline_fallback_response(context=context, prompt=prompt)


# Singleton instance
llm_service: GeminiLLM = GeminiLLM()

