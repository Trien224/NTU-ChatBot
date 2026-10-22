import asyncio
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

logger = logging.getLogger(__name__)


class MongoDBManager:
    """Manages asynchronous MongoDB connection lifecycle and client state."""

    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


mongo_manager = MongoDBManager()


async def connect_to_mongo() -> None:
    """Initialize connection to MongoDB Atlas or local MongoDB instance."""
    try:
        logger.info("Connecting to MongoDB at: %s", settings.MONGO_URI.split("@")[-1])
        mongo_manager.client = AsyncIOMotorClient(
            settings.MONGO_URI,
            serverSelectionTimeoutMS=5000,
        )
        # Verify connection by running a ping command
        await mongo_manager.client.admin.command("ping")
        mongo_manager.db = mongo_manager.client[settings.MONGO_DB_NAME]
        logger.info("Successfully connected to MongoDB database: '%s'", settings.MONGO_DB_NAME)
    except Exception as exc:
        logger.error("Failed to connect to MongoDB: %s", exc, exc_info=True)
        raise exc


async def close_mongo_connection() -> None:
    """Gracefully close the MongoDB client connection pool."""
    if mongo_manager.client:
        logger.info("Closing MongoDB connection pool...")
        try:
            mongo_manager.client.close()
        except Exception:
            pass
        mongo_manager.client = None
        mongo_manager.db = None
        logger.info("MongoDB connection closed.")


def get_database() -> AsyncIOMotorDatabase:
    """Retrieve the active MongoDB database instance, ensuring attachment to the current event loop.

    Returns:
        AsyncIOMotorDatabase: Connected Motor database instance.
    """
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    needs_new_client = False
    if mongo_manager.client is None or mongo_manager.db is None:
        needs_new_client = True
    else:
        try:
            client_loop = mongo_manager.client.get_io_loop()
            if client_loop.is_closed() or (current_loop and client_loop is not current_loop):
                needs_new_client = True
        except Exception:
            needs_new_client = True

    if needs_new_client:
        mongo_manager.client = AsyncIOMotorClient(
            settings.MONGO_URI,
            serverSelectionTimeoutMS=5000,
        )
        mongo_manager.db = mongo_manager.client[settings.MONGO_DB_NAME]

    return mongo_manager.db
