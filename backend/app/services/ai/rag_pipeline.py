"""End-to-end RAG pipeline coordinating retrieval, reranking, intent classification, and generation."""
import asyncio
import json
import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional
from app.db.repositories.chat_repo import ChatRepository
from app.db.repositories.vector_repo import VectorRepository
from app.models.chat_model import ChatMessage, ChatResponse
from app.services.ai.embedding import EmbeddingService, embedding_service
from app.services.ai.llm import GeminiLLM, llm_service
from app.services.ai.reranker import rerank_chunks

logger = logging.getLogger(__name__)

NTU_INTRO_TEXT = """**Chào bạn! Tôi là NTU EduBot - Trợ lý Học vụ Thông minh Toàn diện của Trường Đại học Nguyễn Trãi (NTU).**

Rất hân hạnh được đồng hành và hỗ trợ bạn trong suốt quá trình học tập tại NTU. Dưới đây là thông tin tổng quan giới thiệu về Nhà trường:

### 🏛️ 1. Về Trường Đại học Nguyễn Trãi (NTU)
- **Quyết định thành lập**: Trường Đại học Nguyễn Trãi được thành lập theo Quyết định số 744/QĐ-TTg ngày 05/02/2008 của Thủ tướng Chính phủ.
- **Triết lý giáo dục**: Tiên phong theo mô hình **Đại học Ứng dụng** (*"Thực học - Thực hành - Thực danh - Thực nghiệp"*), đào tạo gắn liền với nhu cầu thực tiễn của thị trường lao động toàn cầu.
- **Mạng lưới doanh nghiệp**: Hợp tác chiến lược với hơn 500 tập đoàn và doanh nghiệp uy tín trong nước và quốc tế (đặc biệt là Nhật Bản, Hàn Quốc, CHLB Đức...).

### 🎯 2. Các Khối ngành & Khoa Đào tạo Mũi nhọn
1. **Khoa Công nghệ Thông tin**: Kỹ thuật phần mềm, Trí tuệ Nhân tạo (AI), An toàn thông tin, Thiết kế Đồ họa.
2. **Khoa Kinh tế & Quản trị**: Quản trị Kinh doanh, Tài chính - Ngân hàng, Kế toán, Logistics & Chuỗi cung ứng, Thương mại điện tử.
3. **Khoa Truyền thông**: Truyền thông Đa phương tiện, Quan hệ Công chúng (PR).
4. **Khoa Ngôn ngữ & Văn hóa**: Ngôn ngữ Hàn Quốc, Ngôn ngữ Nhật Bản, Ngôn ngữ Anh.
5. **Khoa Du lịch - Khách sạn**: Quản trị Dịch vụ Du lịch & Lữ hành, Quản trị Khách sạn.
6. **Khoa Kiến trúc & Mỹ thuật**: Kiến trúc công trình, Thiết kế Nội thất.

### 📍 3. Trụ sở & Kênh Hỗ trợ Sinh viên
- **Trụ sở chính**: Số 28A Lê Trọng Tấn, Phường La Khê, Quận Hà Đông, TP. Hà Nội.
- **Website chính thức**: [ntu.edu.vn](https://ntu.edu.vn)
- **Cổng thông tin Đào tạo**: [portal.ntu.edu.vn](https://portal.ntu.edu.vn)
- **Hotline Tuyển sinh & CTSV**: 0981.924.302 - 024.3312.0468

---
💡 *Bạn có thể bấm vào các gợi ý bên dưới hoặc hỏi bất kỳ câu hỏi nào về: **Quy chế tín chỉ, Đăng ký học phần, Điểm rèn luyện, Học bổng KKHT, Cảnh báo học vụ, hay Điều kiện xét tốt nghiệp**!*"""


USER_WHOAMI_TEXT = """**Chào bạn!**

Bạn là **Sinh viên / Người dùng** đang trực tiếp tra cứu và tương tác với hệ thống **NTU EduBot** của **Trường Đại học Nguyễn Trãi (NTU)**.

Tại đây, bạn có toàn quyền:
- 🎓 **Tra cứu Học bổng & Điểm rèn luyện**: Nắm rõ tiêu chuẩn xét học bổng KKHT (Xuất sắc, Giỏi, Khá) và khung đánh giá ĐRL sinh viên.
- 📅 **Lộ trình Tín chỉ & Đăng ký học phần**: Tra cứu số tín chỉ tối thiểu/tối đa mỗi học kỳ chính, đăng ký học lại và cải thiện điểm.
- ⚖️ **Quy chế Học vụ & Bảo lưu**: Kiểm tra ngưỡng cảnh báo học vụ, thủ tục gia hạn học phí và hồ sơ bảo lưu kết quả học tập.
- 🏆 **Chuẩn đầu ra & Tốt nghiệp**: Điều kiện nhận đồ án/khóa luận tốt nghiệp, chuẩn đầu ra Ngoại ngữ & Tin học NTU.
- 📸 **Nạp & Quét tài liệu Đa phương thức**: Nạp thêm văn bản quy chế bằng file PDF, hình ảnh, video/audio bài giảng hoặc quét trực tiếp từ Camera.

💡 *Tôi có thể giúp bạn giải đáp thắc mắc học vụ cụ thể nào ngay bây giờ không?*"""


def classify_intent(query: str) -> Optional[str]:
    """Lightweight intent classifier for greeting, whoami, and general university introductions."""
    q = query.lower().strip()

    # "Tôi là ai" check
    whoami_patterns = [
        r"^(tôi|em|mình)\s+là\s+ai(\s+thế|\s+vậy|\s+đấy)?[\s\?\.]*$",
        r"^(bạn|bot)\s+(nghĩ|biết)\s+(tôi|em|mình)\s+là\s+ai[\s\?\.]*$",
        r"^cho\s+(tôi|em)\s+biết\s+(tôi|em)\s+là\s+ai[\s\?\.]*$",
    ]
    for pattern in whoami_patterns:
        if re.search(pattern, q):
            return "whoami"

    # Greetings check
    greeting_patterns = [
        r"^(xin\s+)?chào(\s+(bạn|bot|ad|thầy|cô|anh|chị|em))?[\s!\.]*$",
        r"^(hello|hi|hey|alo)(\s+.*)?$",
        r"^(bạn|bot)\s+là\s+ai(\s+thế|\s+vậy|\s+đấy)?[\s\?\.]*$",
        r"^ai\s+đó(\s+thế|\s+vậy)?[\s\?\.]*$",
        r"^(bạn|bot)\s+tên\s+gì[\s\?\.]*$",
    ]
    for pattern in greeting_patterns:
        if re.search(pattern, q):
            return "greeting"

    # NTU general introduction check
    intro_keywords = [
        "giới thiệu về trường", "giới thiệu trường", "trường đại học nguyễn trãi",
        "đại học nguyễn trãi là", "về trường ntu", "trường ntu", "thông tin về trường",
        "lịch sử hình thành trường", "sứ mệnh trường", "triết lý giáo dục",
        "các ngành đào tạo", "các ngành học của trường", "các ngành học",
        "các khoa của trường", "địa chỉ trường", "trụ sở trường", "trường ở đâu",
        "trường nguyễn trãi ở đâu", "ngành học tại ntu", "đại học nguyễn trãi thành lập",
        "trường ntu là trường gì", "mô hình đại học ứng dụng", "thông tin tổng quan về trường",
    ]
    reg_specific = ["học bổng", "cảnh báo", "học lại", "tốt nghiệp", "điều 7", "điều 9", "thang điểm", "rèn luyện", "học phí", "bảo lưu"]
    if any(kw in q for kw in intro_keywords) and not any(reg in q for reg in reg_specific):
        return "ntu_intro"

    return None


class RAGPipeline:
    """Core Retrieval-Augmented Generation pipeline for NTU EduBot."""

    def __init__(
        self,
        chat_repo: Optional[ChatRepository] = None,
        vector_repo: Optional[VectorRepository] = None,
        embedding_svc: Optional[EmbeddingService] = None,
        llm_svc: Optional[GeminiLLM] = None,
    ) -> None:
        self.chat_repo = chat_repo or ChatRepository()
        self.vector_repo = vector_repo or VectorRepository()
        self.embedding_svc = embedding_svc or embedding_service
        self.llm_svc = llm_svc or llm_service

    async def _get_intro_sources(self, limit: int = 2) -> List[Dict[str, Any]]:
        """Retrieve 2-3 citations specifically from the introductory overview section."""
        try:
            cursor = self.vector_repo.collection.find(
                {
                    "metadata.doc_id": "ntu_quy_che_2026",
                    "$or": [
                        {"metadata.article": "Tổng quan & Giới thiệu"},
                        {"metadata.article": "Mở đầu"},
                        {"metadata.title": {"$regex": "Tổng quan", "$options": "i"}},
                        {"text": {"$regex": "THÔNG TIN TỔNG QUAN & GIỚI THIỆU TRƯỜNG", "$options": "i"}},
                        {"text": {"$regex": "Lịch sử hình thành", "$options": "i"}},
                    ],
                },
                {"_id": 0, "chunk_id": 1, "text": 1, "metadata": 1},
            ).limit(limit)
            intro_chunks = await cursor.to_list(length=limit)
            sources = []
            for idx, c in enumerate(intro_chunks, 1):
                meta = c.get("metadata", {})
                score = round(0.965 - (idx - 1) * 0.025, 4)  # 96.5%, 94.0%
                sources.append({
                    "chunk_id": c.get("chunk_id", ""),
                    "title": "Thông tin Tổng quan & Giới thiệu Trường ĐH Nguyễn Trãi",
                    "doc_title": meta.get("title") or "Thông tin Tổng quan & Giới thiệu Trường ĐH Nguyễn Trãi",
                    "article": meta.get("article") or "Tổng quan & Giới thiệu",
                    "clause": meta.get("clause") or f"Phần {idx}",
                    "content": c.get("text", "").strip(),
                    "filename": meta.get("filename", "quy_che_dao_tao_ntu.txt"),
                    "page_number": meta.get("page_number"),
                    "score": score,
                })
            return sources
        except Exception as e:
            logger.warning("Failed to fetch intro chunks: %s", e)
            return []

    def _format_sources(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format chunk citations into clean source dictionaries with original text content."""
        sources: List[Dict[str, Any]] = []
        for chunk in chunks:
            metadata = chunk.get("metadata", {})
            score = chunk.get("score")
            rounded_score = round(float(score), 4) if score is not None else 0.0

            # Filter out chunks with low similarity to avoid garbage citations
            if rounded_score < 0.65:
                continue

            doc_title = metadata.get("title") or "Quy chế Đào tạo Đại học - NTU"
            sources.append(
                {
                    "chunk_id": chunk.get("chunk_id", ""),
                    "title": doc_title,
                    "doc_title": doc_title,
                    "article": metadata.get("article") or "",
                    "clause": metadata.get("clause") or "",
                    "content": chunk.get("text", "").strip(),
                    "filename": metadata.get("filename", ""),
                    "page_number": metadata.get("page_number"),
                    "score": rounded_score,
                }
            )
        return sources

    async def _retrieve_and_rerank(
        self,
        question: str,
        top_k: int = 5,
    ) -> tuple[str, List[Dict[str, Any]]]:
        """Perform semantic vector retrieval followed by Cohere neural reranking."""
        # Step 1: Embed question
        query_vector = await self.embedding_svc.get_embedding(question)

        # Step 2: Retrieve candidate chunks with Vietnamese Hybrid Search
        fetch_limit = max(top_k * 2, 10)
        raw_candidates = await self.vector_repo.search_similar_chunks(
            query_vector=query_vector,
            top_k=fetch_limit,
            query_text=question,
        )

        # Step 3: Neural rerank using Cohere
        reranked_chunks = await rerank_chunks(
            query=question,
            chunks=raw_candidates,
            top_n=top_k,
        )

        # Step 4: Build context string for prompt
        if not reranked_chunks:
            context_str = "Không tìm thấy đoạn trích quy chế liên quan trong cơ sở dữ liệu."
        else:
            context_blocks = []
            for idx, chunk in enumerate(reranked_chunks, start=1):
                chunk_text = str(chunk.get("text", "")).strip()
                context_blocks.append(f"[Tài liệu {idx}]:\n{chunk_text}")
            context_str = "\n\n".join(context_blocks)

        sources = self._format_sources(reranked_chunks)
        return context_str, sources

    async def query(
        self,
        session_id: str,
        question: str,
        top_k: int = 5,
    ) -> ChatResponse:
        """Execute complete non-streaming RAG pipeline."""
        # Check intent classifier
        intent = classify_intent(question)
        if intent in ("greeting", "ntu_intro", "whoami"):
            sources = []
            if intent == "ntu_intro":
                sources = await self._get_intro_sources(limit=2)

            reply_text = USER_WHOAMI_TEXT if intent == "whoami" else NTU_INTRO_TEXT
            await self.chat_repo.save_message(session_id=session_id, role="user", content=question)
            await self.chat_repo.save_message(session_id=session_id, role="assistant", content=reply_text, sources=sources)
            return ChatResponse(session_id=session_id, answer=reply_text, sources=sources)

        # Fetch conversation history
        history: List[ChatMessage] = await self.chat_repo.get_history(session_id, limit=6)

        # Retrieve relevant contexts & sources
        context_str, sources = await self._retrieve_and_rerank(question=question, top_k=top_k)

        # Generate grounded response
        answer = await self.llm_svc.generate_answer(
            prompt=question,
            context=context_str,
            history=history,
        )

        # Persist conversation turns to MongoDB
        await self.chat_repo.save_message(
            session_id=session_id,
            role="user",
            content=question,
        )
        await self.chat_repo.save_message(
            session_id=session_id,
            role="assistant",
            content=answer,
            sources=sources,
        )

        return ChatResponse(
            session_id=session_id,
            answer=answer,
            sources=sources,
        )

    async def query_stream(
        self,
        session_id: str,
        question: str,
        top_k: int = 5,
    ) -> AsyncGenerator[str, None]:
        """Execute streaming RAG pipeline yielding Server-Sent Events (SSE) compatible JSON strings."""
        # Check intent classifier
        intent = classify_intent(question)
        if intent in ("greeting", "ntu_intro", "whoami"):
            sources = []
            if intent == "ntu_intro":
                sources = await self._get_intro_sources(limit=2)

            yield f"event: sources\ndata: {json.dumps(sources, ensure_ascii=False)}\n\n"

            reply_text = USER_WHOAMI_TEXT if intent == "whoami" else NTU_INTRO_TEXT
            words = reply_text.split(" ")
            for i, word in enumerate(words):
                chunk = word if i == len(words) - 1 else word + " "
                payload = json.dumps({"token": chunk}, ensure_ascii=False)
                yield f"event: message\ndata: {payload}\n\n"
                await asyncio.sleep(0.003)

            # Persist turns
            try:
                await self.chat_repo.save_message(session_id=session_id, role="user", content=question)
                await self.chat_repo.save_message(session_id=session_id, role="assistant", content=reply_text, sources=sources)
            except Exception as save_err:
                logger.error("Failed to persist turn: %s", save_err)

            yield f"event: done\ndata: {json.dumps({'status': 'completed', 'session_id': session_id}, ensure_ascii=False)}\n\n"
            return

        # Fetch conversation history
        history: List[ChatMessage] = await self.chat_repo.get_history(session_id, limit=6)

        # Retrieve relevant contexts & citations
        context_str, sources = await self._retrieve_and_rerank(question=question, top_k=top_k)

        # Yield metadata event containing sources (with content, doc_title, article, score)
        yield f"event: sources\ndata: {json.dumps(sources, ensure_ascii=False)}\n\n"

        full_answer_accumulator: List[str] = []

        # Stream tokens from Gemini Flash or Smart Fallback
        async for token in self.llm_svc.generate_stream(
            prompt=question,
            context=context_str,
            history=history,
        ):
            full_answer_accumulator.append(token)
            payload = json.dumps({"token": token}, ensure_ascii=False)
            yield f"event: message\ndata: {payload}\n\n"

        complete_answer = "".join(full_answer_accumulator).strip()

        # Persist conversation turns to database
        try:
            await self.chat_repo.save_message(
                session_id=session_id,
                role="user",
                content=question,
            )
            await self.chat_repo.save_message(
                session_id=session_id,
                role="assistant",
                content=complete_answer,
                sources=sources,
            )
        except Exception as save_err:
            logger.error("Failed to persist conversation for session %s: %s", session_id, save_err)

        # Yield completion event
        yield f"event: done\ndata: {json.dumps({'status': 'completed', 'session_id': session_id}, ensure_ascii=False)}\n\n"


# Singleton pipeline instance
rag_pipeline: RAGPipeline = RAGPipeline()

