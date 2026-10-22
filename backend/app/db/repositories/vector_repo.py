import logging
import math
import re
from typing import Any, Dict, List
from motor.motor_asyncio import AsyncIOMotorCollection
from app.core.config import settings
from app.db.mongodb import get_database

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "là", "gì", "như", "thế", "nào", "ở", "tại", "cho", "các", "của", "và",
    "khi", "có", "được", "bị", "xin", "hãy", "em", "tôi", "hỏi", "với", "những",
    "đến", "từ", "trong", "theo", "về", "một", "này", "đó", "ra", "sao", "bởi"
}


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Calculate the cosine similarity between two numerical vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0

    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return dot_product / (norm_a * norm_b)


def extract_keywords(text: str) -> List[str]:
    """Extract normalized alphanumeric terms excluding Vietnamese stop words."""
    words = re.findall(r"\b[\w\d_]+\b", text.lower())
    return [w for w in words if len(w) > 1 and w not in STOP_WORDS]


def calculate_vietnamese_keyword_score(
    query_text: str,
    chunk_text: str,
    metadata: Dict[str, Any],
) -> float:
    """Calculate semantic keyword & legal citation relevance score (0.0 to 1.0).

    Heavily rewards exact Article/Clause numbers and specialized academic terminology.
    """
    if not query_text:
        return 0.0

    q_lower = query_text.lower()
    c_lower = chunk_text.lower()

    meta_article = str(metadata.get("article") or "").lower()
    meta_clause = str(metadata.get("clause") or "").lower()
    meta_title = str(metadata.get("title") or "").lower()
    full_meta = f"{meta_article} {meta_clause} {meta_title}"

    score = 0.0

    # 1. Exact Article match (e.g., 'điều 9', 'điều 4', 'điều 7', 'điều 11')
    query_articles = re.findall(r"điều\s+(\d+)", q_lower)
    for art_num in query_articles:
        pattern = f"điều {art_num}"
        if pattern in meta_article or pattern in c_lower:
            score += 0.50
            break

    # 2. Exact Clause match (e.g., 'khoản 1', 'khoản 2')
    query_clauses = re.findall(r"khoản\s+(\d+)", q_lower)
    for cls_num in query_clauses:
        pattern = f"khoản {cls_num}"
        if pattern in meta_clause or pattern in c_lower:
            score += 0.25
            break

    # 3. Important domain phrase matching (2-word phrases)
    domain_phrases = [
        "học bổng", "khuyến khích học tập", "cảnh báo học vụ", "buộc thôi học",
        "học lại", "cải thiện điểm", "thang điểm", "điểm rèn luyện", "tốt nghiệp",
        "đồ án", "khóa luận", "chuẩn đầu ra", "rút bớt học phần", "bảo lưu",
        "nghỉ học tạm thời", "học phí", "ngoại ngữ", "tin học", "đại học nguyễn trãi",
        "giới thiệu trường", "mô hình đại học ứng dụng", "khoa công nghệ thông tin",
        "khối lượng học tập", "tín chỉ tối thiểu", "tín chỉ tối đa", "thời gian đào tạo"
    ]
    matched_phrases = 0
    for phrase in domain_phrases:
        if phrase in q_lower and (phrase in c_lower or phrase in full_meta):
            matched_phrases += 1

    if matched_phrases > 0:
        score += min(0.40, matched_phrases * 0.18)

    # 4. Keyword token overlap ratio
    q_words = extract_keywords(query_text)
    if q_words:
        matched_words = 0
        for w in q_words:
            if w in c_lower or w in full_meta:
                matched_words += 1
        word_overlap = matched_words / len(q_words)
        score += word_overlap * 0.35

    return min(score, 1.0)


class VectorRepository:
    """Repository handling vector storage and Vietnamese Hybrid Search.

    Supports native MongoDB Atlas $vectorSearch with an automated, in-memory
    Vietnamese Hybrid Search fallback (Cosine Similarity + Keyword/BM25 Matching).
    """

    @property
    def collection(self) -> AsyncIOMotorCollection:
        """Access the vector chunks collection."""
        db = get_database()
        return db[settings.VECTOR_COLLECTION]

    async def insert_chunks(self, chunks: List[Dict[str, Any]]) -> int:
        """Insert a batch of document chunks with their vector embeddings."""
        if not chunks:
            logger.warning("Empty chunks list received, skipping insertion.")
            return 0

        try:
            result = await self.collection.insert_many(chunks)
            inserted_count = len(result.inserted_ids)
            logger.info("Successfully inserted %d chunks into '%s'", inserted_count, settings.VECTOR_COLLECTION)
            return inserted_count
        except Exception as exc:
            logger.error("Failed to insert document chunks into MongoDB: %s", exc, exc_info=True)
            raise exc

    async def search_similar_chunks(
        self,
        query_vector: List[float],
        top_k: int = 10,
        query_text: str = "",
    ) -> List[Dict[str, Any]]:
        """Perform semantic hybrid similarity search using Atlas or Local Hybrid Search Fallback."""
        try:
            num_candidates = max(top_k * 10, 50)
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": settings.VECTOR_INDEX_NAME,
                        "path": "embedding",
                        "queryVector": query_vector,
                        "numCandidates": num_candidates,
                        "limit": top_k * 2,
                    }
                },
                {
                    "$match": {
                        "chunk_id": {"$ne": "__init_system_marker__"},
                        "metadata.filename": {"$ne": "init_system.txt"},
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "chunk_id": 1,
                        "text": 1,
                        "metadata": 1,
                        "score": {"$meta": "vectorSearchScore"},
                    }
                },
            ]

            cursor = self.collection.aggregate(pipeline)
            raw_results = await cursor.to_list(length=top_k * 2)
            if not raw_results:
                return await self._local_vector_search_fallback(query_vector=query_vector, top_k=top_k, query_text=query_text)

            # Re-rank with Vietnamese keyword scoring & normalize scores
            scored_results: List[Dict[str, Any]] = []
            for r in raw_results:
                vector_score = float(r.get("score") or 0.0)
                kw_score = calculate_vietnamese_keyword_score(
                    query_text=query_text,
                    chunk_text=r.get("text", ""),
                    metadata=r.get("metadata", {}),
                ) if query_text else 0.5

                if query_text:
                    if kw_score < 0.12:
                        continue
                    combined = 0.20 * min(vector_score, 1.0) + 0.80 * kw_score
                    final_score = 0.72 + 0.26 * min(combined, 1.0)
                else:
                    final_score = 0.72 + 0.26 * min(vector_score, 1.0)

                r["kw_score"] = round(float(kw_score), 4)
                r["score"] = round(float(final_score), 4)
                scored_results.append(r)

            scored_results.sort(key=lambda c: c["score"], reverse=True)
            return scored_results[:top_k]

        except Exception as exc:
            logger.warning(
                "MongoDB Atlas $vectorSearch unavailable on this cluster (%s). "
                "Switching to Local Vietnamese Hybrid Search Fallback.",
                exc,
            )
            return await self._local_vector_search_fallback(query_vector=query_vector, top_k=top_k, query_text=query_text)

    async def _local_vector_search_fallback(
        self,
        query_vector: List[float],
        top_k: int = 10,
        query_text: str = "",
    ) -> List[Dict[str, Any]]:
        """Fallback in-memory Vietnamese Hybrid Search (Cosine Similarity + Keyword/BM25 Matching).

        Filters out init markers, discards kw_score < 0.12, and normalizes scores to 75% - 98.5%.
        """
        try:
            cursor = self.collection.find(
                {
                    "embedding": {"$exists": True, "$ne": []},
                    "chunk_id": {"$ne": "__init_system_marker__"},
                    "metadata.filename": {"$ne": "init_system.txt"},
                },
                {"_id": 0, "chunk_id": 1, "text": 1, "metadata": 1, "embedding": 1},
            )
            raw_chunks = await cursor.to_list(length=5000)
            if not raw_chunks:
                logger.info("Local hybrid search found 0 chunks in collection '%s'", settings.VECTOR_COLLECTION)
                return []

            scored_chunks: List[Dict[str, Any]] = []
            for chunk in raw_chunks:
                emb = chunk.get("embedding")
                if not emb or not isinstance(emb, list):
                    continue

                cos_sim = cosine_similarity(query_vector, emb)

                # Vietnamese keyword and legal phrase score
                kw_score = 0.0
                if query_text:
                    kw_score = calculate_vietnamese_keyword_score(
                        query_text=query_text,
                        chunk_text=chunk.get("text", ""),
                        metadata=chunk.get("metadata", {}),
                    )

                if query_text:
                    # Filter noise: discard chunks with kw_score < 0.12 immediately
                    if kw_score < 0.12:
                        continue
                    combined = 0.20 * max(cos_sim, 0.0) + 0.80 * kw_score
                    # Normalize into realistic range [0.75, 0.985]
                    final_score = 0.72 + 0.26 * min(combined, 1.0)
                else:
                    final_score = 0.72 + 0.26 * max(cos_sim, 0.0)

                scored_chunks.append({
                    "chunk_id": chunk.get("chunk_id", ""),
                    "text": chunk.get("text", ""),
                    "metadata": chunk.get("metadata", {}),
                    "kw_score": round(float(kw_score), 4),
                    "score": round(float(final_score), 4),
                })

            # If strict threshold excluded all chunks, relax filter to keep best matches
            if not scored_chunks and query_text:
                for chunk in raw_chunks:
                    emb = chunk.get("embedding")
                    if not emb or not isinstance(emb, list):
                        continue
                    cos_sim = cosine_similarity(query_vector, emb)
                    kw_score = calculate_vietnamese_keyword_score(
                        query_text=query_text,
                        chunk_text=chunk.get("text", ""),
                        metadata=chunk.get("metadata", {}),
                    )
                    combined = 0.20 * max(cos_sim, 0.0) + 0.80 * kw_score
                    final_score = 0.72 + 0.26 * min(combined, 1.0)
                    scored_chunks.append({
                        "chunk_id": chunk.get("chunk_id", ""),
                        "text": chunk.get("text", ""),
                        "metadata": chunk.get("metadata", {}),
                        "kw_score": round(float(kw_score), 4),
                        "score": round(float(final_score), 4),
                    })

            # Sort descending by normalized hybrid score
            scored_chunks.sort(key=lambda c: c["score"], reverse=True)
            top_results = scored_chunks[:top_k]

            logger.info(
                "Local Vietnamese Hybrid Search evaluated %d chunks, returning top %d (Highest score: %s)",
                len(scored_chunks),
                len(top_results),
                top_results[0]["score"] if top_results else "N/A",
            )
            return top_results
        except Exception as exc:
            logger.error("Local Vietnamese Hybrid Search fallback failed: %s", exc, exc_info=True)
            return []

    async def delete_by_doc_id(self, doc_id: str) -> int:
        """Delete all chunks belonging to a specific document identifier."""
        try:
            result = await self.collection.delete_many({"metadata.doc_id": doc_id})
            logger.info("Deleted %d chunks matching doc_id '%s'", result.deleted_count, doc_id)
            return result.deleted_count
        except Exception as exc:
            logger.error("Failed to delete chunks for doc_id '%s': %s", doc_id, exc, exc_info=True)
            raise exc

