"""Embedding service utilizing Google GenAI SDK and text-embedding-004 model with Smart Offline Fallback."""
import hashlib
import logging
import math
from typing import List
from google import genai
from app.core.config import settings
from app.core.key_manager import key_manager

logger = logging.getLogger(__name__)


def generate_pseudo_embedding(text: str, dim: int = 768) -> List[float]:
    """Generate a deterministic, normalized 768-dimensional unit pseudo-vector.

    Used as an offline fallback when Gemini API keys are placeholders or encounter errors.
    """
    clean = text.strip()
    values: List[float] = []
    for i in range(dim):
        h = hashlib.sha256(f"{clean}_{i}".encode("utf-8")).digest()
        seed_int = int.from_bytes(h[:4], byteorder="little")
        val = math.sin(seed_int * 0.0001)
        values.append(val)

    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [round(v / norm, 6) for v in values]


class EmbeddingService:
    """Generates vector embeddings with Google Gemini and dynamic key rotation."""

    def __init__(self, model: str = settings.EMBEDDING_MODEL) -> None:
        self.model = model

    async def get_embedding(self, text: str) -> List[float]:
        """Generate vector embedding for a single text string.

        Args:
            text: Text to be embedded.

        Returns:
            List[float]: High-dimensional vector representation.
        """
        clean_text = text.strip()
        if not clean_text:
            return generate_pseudo_embedding("empty")

        max_retries = max(key_manager.total_keys, 1)
        last_error: Exception = RuntimeError("No Gemini API keys available")

        if key_manager.total_keys > 0:
            for attempt in range(max_retries):
                api_key = key_manager.get_next_key()
                # Skip known placeholder keys
                if api_key.startswith("key_"):
                    continue
                try:
                    client = genai.Client(api_key=api_key)
                    response = await client.aio.models.embed_content(
                        model=self.model,
                        contents=clean_text,
                    )
                    if response.embeddings and len(response.embeddings) > 0:
                        embedding_values = response.embeddings[0].values
                        if embedding_values:
                            return list(embedding_values)
                except Exception as exc:
                    last_error = exc
                    logger.warning(
                        "Embedding generation attempt %d failed with key ...%s (%s)",
                        attempt + 1,
                        api_key[-6:] if len(api_key) >= 6 else "***",
                        exc,
                    )

        # Smart Offline Fallback: deterministic unit vector
        logger.info("Using Smart Offline Fallback for single embedding (Text: '%.40s...')", clean_text)
        return generate_pseudo_embedding(clean_text)

    async def get_embeddings(self, texts: List[str], batch_size: int = 20) -> List[List[float]]:
        """Generate vector embeddings for a list of text strings in batches.

        Args:
            texts: List of strings to be embedded.
            batch_size: Number of texts per batch request.

        Returns:
            List[List[float]]: List of vector embeddings corresponding to input texts.
        """
        if not texts:
            return []

        all_embeddings: List[List[float]] = []

        # Check if we should attempt Gemini API
        has_usable_keys = key_manager.total_keys > 0 and not all(k.startswith("key_") for k in key_manager._keys)

        if has_usable_keys:
            for i in range(0, len(texts), batch_size):
                batch = [t.strip() for t in texts[i : i + batch_size]]
                max_retries = max(key_manager.total_keys, 1)
                batch_success = False

                for attempt in range(max_retries):
                    api_key = key_manager.get_next_key()
                    if api_key.startswith("key_"):
                        continue
                    try:
                        client = genai.Client(api_key=api_key)
                        response = await client.aio.models.embed_content(
                            model=self.model,
                            contents=batch,
                        )
                        if response.embeddings:
                            for emb in response.embeddings:
                                if emb.values:
                                    all_embeddings.append(list(emb.values))
                                else:
                                    all_embeddings.append(generate_pseudo_embedding("empty"))
                            batch_success = True
                            break
                    except Exception as exc:
                        logger.warning(
                            "Batch embedding attempt %d failed with key ...%s (%s)",
                            attempt + 1,
                            api_key[-6:] if len(api_key) >= 6 else "***",
                            exc,
                        )

                if not batch_success:
                    # Smart Offline Fallback for this batch
                    for single_text in batch:
                        all_embeddings.append(generate_pseudo_embedding(single_text))
        else:
            # Direct Smart Offline Fallback
            logger.info("Generating %d pseudo-embeddings via Smart Offline Fallback", len(texts))
            for single_text in texts:
                all_embeddings.append(generate_pseudo_embedding(single_text))

        return all_embeddings


# Global singleton instance
embedding_service = EmbeddingService()


async def get_embedding(text: str) -> List[float]:
    """Convenience helper to get vector embedding for single text."""
    return await embedding_service.get_embedding(text)


async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Convenience helper to get vector embeddings for multiple texts."""
    return await embedding_service.get_embeddings(texts)
