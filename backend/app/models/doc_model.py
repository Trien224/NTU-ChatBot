from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DocumentMetadata(BaseModel):
    """Metadata attributes associated with a document chunk."""

    doc_id: str = Field(..., description="Unique identifier for the parent document")
    filename: str = Field(..., description="Original filename of the ingested document")
    title: Optional[str] = Field(default=None, description="Document title or section headline")
    article: Optional[str] = Field(default=None, description="Regulatory article identifier (e.g., Điều 5)")
    clause: Optional[str] = Field(default=None, description="Specific clause or subsection (e.g., Khoản 2)")
    page_number: Optional[int] = Field(default=None, description="Page number where the chunk is located")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when the chunk was created",
    )


class DocumentChunk(BaseModel):
    """Segment of document content prepared for vector embedding and retrieval."""

    chunk_id: str = Field(..., description="Unique identifier for this specific chunk")
    text: str = Field(..., description="Extracted textual content of the chunk")
    embedding: Optional[List[float]] = Field(
        default=None,
        description="Vector representation of the chunk text",
    )
    metadata: DocumentMetadata = Field(..., description="Associated document metadata")


class UploadResponse(BaseModel):
    """API response model after uploading and processing a document."""

    success: bool = Field(default=True, description="Indicates whether ingestion succeeded")
    message: str = Field(..., description="Descriptive status message")
    doc_id: str = Field(..., description="Unique document ID assigned to the uploaded file")
    filename: str = Field(..., description="Original filename")
    total_chunks: int = Field(default=0, description="Total chunks extracted and stored")
    extra_info: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional diagnostics or processing metrics",
    )
