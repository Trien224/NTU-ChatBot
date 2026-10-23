import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorCollection
from app.core.config import settings
from app.db.mongodb import get_database
from app.models.chat_model import ChatMessage, SessionMetadata

logger = logging.getLogger(__name__)


class ChatRepository:
    """Repository handling persistence and retrieval of chat conversations and sessions in MongoDB."""

    @property
    def collection(self) -> AsyncIOMotorCollection:
        """Access the chat histories collection."""
        db = get_database()
        return db[settings.CHAT_COLLECTION]

    @property
    def sessions_collection(self) -> AsyncIOMotorCollection:
        """Access the chat sessions metadata collection."""
        db = get_database()
        return db.get_collection("chat_sessions")

    async def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None,
    ) -> bool:
        """Save a new chat message to the history collection and update session metadata.

        Args:
            session_id: The conversation session identifier.
            role: Originator role ('user' or 'assistant').
            content: The text message content.
            sources: Optional list of retrieved citations and references.

        Returns:
            bool: True if inserted successfully, False otherwise.
        """
        try:
            now = datetime.now(timezone.utc)
            document = {
                "session_id": session_id,
                "role": role,
                "content": content,
                "sources": sources or [],
                "timestamp": now,
            }
            result = await self.collection.insert_one(document)

            # Update or create session metadata
            clean_text = content.strip().replace("\n", " ")
            suggested_title = clean_text[:42] + ("..." if len(clean_text) > 42 else "")
            if not suggested_title:
                suggested_title = "Cuộc trò chuyện mới"

            existing_session = await self.sessions_collection.find_one({"session_id": session_id})
            if not existing_session:
                await self.sessions_collection.insert_one({
                    "session_id": session_id,
                    "title": suggested_title if role == "user" else "Tư vấn Học vụ NTU",
                    "is_pinned": False,
                    "created_at": now,
                    "updated_at": now,
                    "message_count": 1,
                })
            else:
                update_fields = {"updated_at": now}
                # If existing title is still generic and user sends a question, update title
                if existing_session.get("title") in ("Cuộc trò chuyện mới", "Tư vấn Học vụ NTU") and role == "user":
                    update_fields["title"] = suggested_title

                await self.sessions_collection.update_one(
                    {"session_id": session_id},
                    {
                        "$set": update_fields,
                        "$inc": {"message_count": 1},
                    },
                )

            return bool(result.acknowledged)
        except Exception as exc:
            logger.error("Failed to save chat message for session %s: %s", session_id, exc, exc_info=True)
            return False

    async def get_history(self, session_id: str, limit: int = 50) -> List[ChatMessage]:
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
            raw_docs.reverse()
            return [ChatMessage(**doc) for doc in raw_docs]
        except Exception as exc:
            logger.error("Failed to get chat history for session %s: %s", session_id, exc, exc_info=True)
            return []

    async def list_sessions(self, limit: int = 50) -> List[SessionMetadata]:
        """List all chat sessions, with pinned sessions prioritized first, then sorted by updated_at desc.

        Args:
            limit: Maximum number of sessions to return.

        Returns:
            List[SessionMetadata]: Sessions with metadata.
        """
        try:
            # First backfill any session IDs found in chat_histories that lack a chat_sessions record
            distinct_session_ids = await self.collection.distinct("session_id")
            for sid in distinct_session_ids:
                exists = await self.sessions_collection.find_one({"session_id": sid})
                if not exists:
                    # Find first user message to get title and creation date
                    first_msg = await self.collection.find_one(
                        {"session_id": sid, "role": "user"},
                        sort=[("timestamp", 1)],
                    )
                    title = "Cuộc trò chuyện cũ"
                    created_at = datetime.now(timezone.utc)
                    if first_msg:
                        c_text = first_msg.get("content", "").strip().replace("\n", " ")
                        title = c_text[:42] + ("..." if len(c_text) > 42 else "")
                        created_at = first_msg.get("timestamp", created_at)

                    count = await self.collection.count_documents({"session_id": sid})
                    await self.sessions_collection.insert_one({
                        "session_id": sid,
                        "title": title or "Cuộc trò chuyện cũ",
                        "is_pinned": False,
                        "created_at": created_at,
                        "updated_at": created_at,
                        "message_count": count,
                    })

            # Fetch sorted sessions: pinned first (is_pinned: True -> 1), then updated_at descending
            cursor = (
                self.sessions_collection.find({}, {"_id": 0})
                .sort([("is_pinned", -1), ("updated_at", -1)])
                .limit(limit)
            )
            docs = await cursor.to_list(length=limit)
            return [SessionMetadata(**doc) for doc in docs]
        except Exception as exc:
            logger.error("Failed to list chat sessions: %s", exc, exc_info=True)
            return []

    async def get_session(self, session_id: str) -> Optional[SessionMetadata]:
        """Get metadata for a specific session."""
        try:
            doc = await self.sessions_collection.find_one({"session_id": session_id}, {"_id": 0})
            if doc:
                return SessionMetadata(**doc)
            return None
        except Exception as exc:
            logger.error("Failed to get session metadata for %s: %s", session_id, exc)
            return None

    async def update_session(
        self,
        session_id: str,
        title: Optional[str] = None,
        is_pinned: Optional[bool] = None,
    ) -> Optional[SessionMetadata]:
        """Update session title or pinned status."""
        try:
            update_data: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
            if title is not None and title.strip():
                update_data["title"] = title.strip()
            if is_pinned is not None:
                update_data["is_pinned"] = bool(is_pinned)

            result = await self.sessions_collection.find_one_and_update(
                {"session_id": session_id},
                {"$set": update_data},
                return_document=True,
                projection={"_id": 0},
            )
            if result:
                return SessionMetadata(**result)

            # If not in collection, insert with new values
            now = datetime.now(timezone.utc)
            new_doc = {
                "session_id": session_id,
                "title": title.strip() if title else "Cuộc trò chuyện mới",
                "is_pinned": bool(is_pinned) if is_pinned is not None else False,
                "created_at": now,
                "updated_at": now,
                "message_count": await self.collection.count_documents({"session_id": session_id}),
            }
            await self.sessions_collection.insert_one(new_doc)
            new_doc.pop("_id", None)
            return SessionMetadata(**new_doc)
        except Exception as exc:
            logger.error("Failed to update session %s: %s", session_id, exc, exc_info=True)
            return None

    async def clear_history(self, session_id: str) -> bool:
        """Remove all recorded messages and session metadata associated with a session.

        Args:
            session_id: Target session identifier.

        Returns:
            bool: True if operation completed, False on failure.
        """
        try:
            result = await self.collection.delete_many({"session_id": session_id})
            await self.sessions_collection.delete_one({"session_id": session_id})
            logger.info("Cleared %d messages and deleted session %s", result.deleted_count, session_id)
            return True
        except Exception as exc:
            logger.error("Failed to clear chat history for session %s: %s", session_id, exc, exc_info=True)
            return False
