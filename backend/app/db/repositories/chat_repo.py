import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorCollection
from app.core.config import settings
from app.db.mongodb import get_database
from app.models.chat_model import ChatMessage

logger = logging.getLogger(__name__)


class ChatRepository:
    """Repository handling persistence and retrieval of chat conversations in MongoDB."""

    @property
    def collection(self) -> AsyncIOMotorCollection:
        """Access the chat histories collection."""
        db = get_database()
        return db[settings.CHAT_COLLECTION]

    async def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None,
    ) -> bool:
        """Save a new chat message to the history collection.

        Args:
            session_id: The conversation session identifier.
            role: Originator role ('user' or 'assistant').
            content: The text message content.
            sources: Optional list of retrieved citations and references.

        Returns:
            bool: True if inserted successfully, False otherwise.
        """
        try:
            document = {
                "session_id": session_id,
                "role": role,
                "content": content,
                "sources": sources or [],
                "timestamp": datetime.now(timezone.utc),
            }
            result = await self.collection.insert_one(document)
            return bool(result.acknowledged)
        except Exception as exc:
            logger.error("Failed to save chat message for session %s: %s", session_id, exc, exc_info=True)
            return False

    async def get_history(self, session_id: str, limit: int = 10) -> List[ChatMessage]:
        """Fetch the most recent messages for a session in chronological order.

        Args:
            session_id: Target session identifier.
            limit: Maximum number of recent messages to retrieve.

        Returns:
            List[ChatMessage]: List of messages sorted from oldest to newest.
        """
        try:
            cursor = (
                self.collection.find({"session_id": session_id}, {"_id": 0})
                .sort("timestamp", -1)
                .limit(limit)
            )
            raw_docs = await cursor.to_list(length=limit)
            # Reverse to maintain chronological order (oldest -> newest)
            raw_docs.reverse()
            return [ChatMessage(**doc) for doc in raw_docs]
        except Exception as exc:
            logger.error("Failed to get chat history for session %s: %s", session_id, exc, exc_info=True)
            return []

    async def clear_history(self, session_id: str) -> bool:
        """Remove all recorded messages associated with a session.

        Args:
            session_id: Target session identifier.

        Returns:
            bool: True if operation completed, False on failure.
        """
        try:
            result = await self.collection.delete_many({"session_id": session_id})
            logger.info("Cleared %d messages for session %s", result.deleted_count, session_id)
            return True
        except Exception as exc:
            logger.error("Failed to clear chat history for session %s: %s", session_id, exc, exc_info=True)
            return False
