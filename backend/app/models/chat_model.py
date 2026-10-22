from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Schema representing an individual conversational exchange."""

    role: Literal["user", "assistant"] = Field(
        ...,
        description="Originator role of the message (either 'user' or 'assistant')",
    )
    content: str = Field(..., description="Textual body of the message")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when the message was recorded",
    )
    sources: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list,
        description="References, retrieved citations, and chunk scores",
    )


class ChatRequest(BaseModel):
    """Payload sent by the client to query the RAG chatbot."""

    session_id: str = Field(
        ...,
        min_length=1,
        description="Unique session identifier for contextual memory",
        examples=["session_abc123"],
    )
    question: str = Field(
        ...,
        min_length=1,
        description="User's natural language question regarding regulations",
        examples=["Điều kiện để được xét học bổng khuyến khích học tập là gì?"],
    )
    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of relevant chunks to retrieve before reranking",
    )


class ChatResponse(BaseModel):
    """Standardized response delivered to the client following RAG synthesis."""

    session_id: str = Field(..., description="Active session identifier")
    answer: str = Field(..., description="Generated answer from the AI assistant")
    sources: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Cited articles, clauses, and document references",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of response generation",
    )


class ChatHistoryResponse(BaseModel):
    """Response returned when fetching historical interactions of a session."""

    session_id: str = Field(..., description="Queried session identifier")
    total_messages: int = Field(default=0, description="Total count of retrieved messages")
    messages: List[ChatMessage] = Field(
        default_factory=list,
        description="Chronological list of conversation messages",
    )
