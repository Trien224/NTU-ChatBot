"""Reranker service utilizing Cohere Rerank API (rerank-v3.5) with graceful fallback."""
import logging
from typing import Any, Dict, List, Optional
import cohere
from app.core.config import settings

logger = logging.getLogger(__name__)


class CohereReranker:
    """Reranks retrieved candidate chunks using Cohere's neural reranker model."""

    def __init__(self, api_key: str = settings.COHERE_API_KEY, model: str = settings.RERANK_MODEL) -> None:
        self.api_key = api_key
        self.model = model
        self._client: Optional[cohere.AsyncClientV2] = None

    @property
    def client(self) -> Optional[cohere.AsyncClientV2]:
        """Lazy-initialize and return the Cohere asynchronous client."""
        if not self.api_key or self.api_key == "your_cohere_api_key":
            return None
        if self._client is None:
            self._client = cohere.AsyncClientV2(api_key=self.api_key)
        return self._client

    async def rerank_chunks(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        top_n: int = 5,
    ) -> List[Dict[str, Any]]:
        """Rerank retrieved chunks based on their semantic relevance to the query.

        Args:
            query: The user question or search prompt.
            chunks: List of raw candidate chunk dictionaries from MongoDB Atlas.
            top_n: Number of highest-ranking chunks to retain.

        Returns:
            List[Dict[str, Any]]: Reranked chunk list with updated relevance scores.
        """
        if not chunks:
            return []

        # If Cohere API key is absent or empty, gracefully fall back to vector search order
        client = self.client
        if client is None:
            logger.warning(
                "Cohere API key is not configured or placeholder detected. "
                "Gracefully returning initial top %d chunks from vector search.",
                top_n,
            )
            result_chunks = []
            for c in chunks[:top_n]:
                item = dict(c)
                kw = float(item.get("kw_score", 0.6))
                item["score"] = round(0.72 + 0.26 * max(item.get("score", 0.75), kw), 4)
                result_chunks.append(item)
            return result_chunks

        try:
            # Extract textual content from candidate chunks
            documents = [str(chunk.get("text", "")).strip() for chunk in chunks]

            response = await client.rerank(
                model=self.model,
                query=query,
                documents=documents,
                top_n=min(top_n, len(documents)),
            )

            reranked_chunks: List[Dict[str, Any]] = []
            for item in response.results:
                original_index = item.index
                relevance_score = float(item.relevance_score)

                chunk = dict(chunks[original_index])
                chunk["original_score"] = chunk.get("score")
                chunk["rerank_score"] = relevance_score
                kw_val = float(chunk.get("kw_score", 0.5))
                # Combine Cohere neural score with Vietnamese keyword match
                final_score = round(0.72 + 0.26 * max(relevance_score, kw_val), 4)
                chunk["score"] = final_score
                reranked_chunks.append(chunk)

            logger.info(
                "Cohere rerank successfully reordered %d chunks down to %d",
                len(chunks),
                len(reranked_chunks),
            )
            return reranked_chunks

        except Exception as exc:
            logger.warning(
                "Cohere reranking failed (%s). Gracefully falling back to initial vector ranking.",
                exc,
                exc_info=True,
            )
            result_chunks = []
            for c in chunks[:top_n]:
                item = dict(c)
                kw = float(item.get("kw_score", 0.6))
                item["score"] = round(0.72 + 0.26 * max(item.get("score", 0.75), kw), 4)
                result_chunks.append(item)
            return result_chunks


# Singleton instance
cohere_reranker = CohereReranker()


async def rerank_chunks(
    query: str,
    chunks: List[Dict[str, Any]],
    top_n: int = 5,
) -> List[Dict[str, Any]]:
    """Convenience helper to rerank chunks using Cohere API."""
    return await cohere_reranker.rerank_chunks(query=query, chunks=chunks, top_n=top_n)
