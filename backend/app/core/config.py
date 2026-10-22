from pathlib import Path
from typing import List
from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Application configuration loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), ".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application settings
    APP_NAME: str = "NTU EduBot API"
    DEBUG: bool = False

    # MongoDB Atlas Configuration
    MONGO_URI: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection URI (MongoDB Atlas or local)",
    )
    MONGO_DB_NAME: str = Field(
        default="ntu_edubot_db",
        description="Name of the application database",
    )
    VECTOR_COLLECTION: str = Field(
        default="document_chunks",
        description="Collection name for document vector embeddings",
    )
    CHAT_COLLECTION: str = Field(
        default="chat_histories",
        description="Collection name for session chat histories",
    )
    VECTOR_INDEX_NAME: str = Field(
        default="vector_index",
        description="Atlas Vector Search index name",
    )

    # Gemini AI Configuration
    GEMINI_API_KEYS: str = Field(
        default="",
        description="Comma-separated Gemini API keys for rotation",
    )

    # Cohere Configuration
    COHERE_API_KEY: str = Field(
        default="",
        description="Cohere API key for semantic reranking",
    )

    # AI Models
    EMBEDDING_MODEL: str = Field(
        default="text-embedding-004",
        description="Gemini text embedding model name",
    )
    LLM_MODEL: str = Field(
        default="gemini-2.5-flash",
        description="Gemini generative model name",
    )
    RERANK_MODEL: str = Field(
        default="rerank-v3.5",
        description="Cohere reranker model name",
    )

    @computed_field
    @property
    def gemini_keys_list(self) -> List[str]:
        """Parse comma-separated GEMINI_API_KEYS into a clean list of valid keys.

        Returns:
            List[str]: Cleaned list of Gemini API keys without whitespace.
        """
        if not self.GEMINI_API_KEYS:
            return []
        keys = [key.strip() for key in self.GEMINI_API_KEYS.split(",") if key.strip()]
        return keys


# Singleton settings instance
settings: Settings = Settings()
