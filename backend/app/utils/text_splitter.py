"""Text splitting utilities tailored for academic regulations and legal documents.

Implements structural regex-based parsing according to legal hierarchy:
Chương (Chapter) -> Điều (Article) -> Khoản (Clause) -> Điểm (Point)
with fallback to RecursiveCharacterTextSplitter for oversized segments,
ensuring metadata enrichment on every resulting chunk.
"""

import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from app.models.doc_model import DocumentChunk, DocumentMetadata

logger = logging.getLogger(__name__)


class RecursiveCharacterTextSplitter:
    """Fallback recursive splitter splitting along semantic separators."""

    def __init__(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 100,
        separators: Optional[List[str]] = None,
    ) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", "; ", ", ", " ", ""]

    def split_text(self, text: str) -> List[str]:
        """Split text into chunks of at most chunk_size with chunk_overlap."""
        text = text.strip()
        if not text:
            return []

        if len(text) <= self.chunk_size:
            return [text]

        return self._split(text, self.separators)

    def _split(self, text: str, separators: List[str]) -> List[str]:
        final_chunks: List[str] = []
        separator = separators[-1]
        new_separators: List[str] = []

        for i, sep in enumerate(separators):
            if sep == "":
                separator = ""
                break
            if sep in text:
                separator = sep
                new_separators = separators[i + 1 :]
                break

        splits = text.split(separator) if separator else list(text)
        good_splits: List[str] = []

        for piece in splits:
            if not piece:
                continue
            if len(piece) <= self.chunk_size:
                good_splits.append(piece)
            else:
                if new_separators:
                    sub_splits = self._split(piece, new_separators)
                    good_splits.extend(sub_splits)
                else:
                    # Hard split
                    for start in range(0, len(piece), self.chunk_size - self.chunk_overlap):
                        good_splits.append(piece[start : start + self.chunk_size])

        # Merge good_splits respecting chunk_size and chunk_overlap
        current_chunk: List[str] = []
        current_length = 0

        for piece in good_splits:
            piece_len = len(piece)
            sep_len = len(separator) if separator else 0
            if current_length + piece_len + (sep_len if current_chunk else 0) <= self.chunk_size:
                current_chunk.append(piece)
                current_length += piece_len + (sep_len if len(current_chunk) > 1 else 0)
            else:
                if current_chunk:
                    joined = separator.join(current_chunk).strip()
                    if joined:
                        final_chunks.append(joined)
                    # Keep overlap pieces
                    overlap_chunk: List[str] = []
                    overlap_len = 0
                    for prev_piece in reversed(current_chunk):
                        if overlap_len + len(prev_piece) <= self.chunk_overlap:
                            overlap_chunk.insert(0, prev_piece)
                            overlap_len += len(prev_piece)
                        else:
                            break
                    current_chunk = overlap_chunk
                    current_length = sum(len(p) for p in current_chunk) + (
                        len(separator) * (len(current_chunk) - 1) if len(current_chunk) > 1 else 0
                    )

                current_chunk.append(piece)
                current_length += piece_len + (sep_len if len(current_chunk) > 1 else 0)

        if current_chunk:
            joined = separator.join(current_chunk).strip()
            if joined:
                final_chunks.append(joined)

        return final_chunks


class RegExTextSplitter:
    """Specialized text splitter for Vietnamese university regulations.

    Deconstructs documents into semantic legal blocks (Chương, Điều, Khoản),
    enriches each chunk with its structural hierarchy, and applies recursive
    sub-splitting with overlap if any section exceeds the token limit.
    """

    # Regex definitions for regulatory structures
    CHAPTER_PATTERN = re.compile(
        r"(?i)(?:^|\n)\s*(CHƯƠNG\s+[IVXLCDM\d]+[^\n]*)",
        re.MULTILINE,
    )
    ARTICLE_PATTERN = re.compile(
        r"(?i)(?:^|\n)\s*(Điều\s+\d+[\.:]?[^\n]*)",
        re.MULTILINE,
    )
    CLAUSE_PATTERN = re.compile(
        r"(?i)(?:^|\n)\s*(?:Khoản\s+(\d+)[\.:]?|(\d+)[\.:]\s+)([^\n]*)",
        re.MULTILINE,
    )

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 100) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.fallback_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    def split_document(
        self,
        text: str,
        doc_id: str,
        filename: str,
        base_title: Optional[str] = None,
        page_number: Optional[int] = None,
    ) -> List[DocumentChunk]:
        """Split a regulatory text document into structured, enriched DocumentChunk instances.

        Args:
            text: Full text content of the regulation.
            doc_id: Unique document identifier.
            filename: Source filename.
            base_title: Main document title.
            page_number: Optional starting or reference page number.

        Returns:
            List[DocumentChunk]: List of enriched document chunks ready for vector indexing.
        """
        clean_text = text.replace("\r\n", "\n").strip()
        if not clean_text:
            return []

        # Find all Article boundaries
        article_matches = list(self.ARTICLE_PATTERN.finditer(clean_text))

        # If no "Điều" is detected, fallback directly to recursive character splitting
        if not article_matches:
            logger.info("No 'Điều' structure found in text for doc %s. Applying fallback splitter.", doc_id)
            fallback_chunks = self.fallback_splitter.split_text(clean_text)
            results: List[DocumentChunk] = []
            for idx, raw_chunk in enumerate(fallback_chunks, start=1):
                enriched_text = f"[{base_title or filename} - Phần {idx}]\n{raw_chunk}"
                meta = DocumentMetadata(
                    doc_id=doc_id,
                    filename=filename,
                    title=base_title or filename,
                    article=None,
                    clause=None,
                    page_number=page_number,
                )
                results.append(
                    DocumentChunk(
                        chunk_id=f"{doc_id}_chunk_{idx:04d}",
                        text=enriched_text,
                        embedding=None,
                        metadata=meta,
                    )
                )
            return results

        # Process structured articles
        chunks: List[DocumentChunk] = []
        chunk_counter = 1

        # Check preamble text before the first "Điều"
        first_article_start = article_matches[0].start()
        if first_article_start > 0:
            preamble = clean_text[:first_article_start].strip()
            if preamble:
                preamble_splits = self.fallback_splitter.split_text(preamble)
                for p_chunk in preamble_splits:
                    enriched_preamble = f"[{base_title or filename} - Lời mở đầu]\n{p_chunk}"
                    meta = DocumentMetadata(
                        doc_id=doc_id,
                        filename=filename,
                        title=f"{base_title or filename} - Tổng quan",
                        article="Tổng quan & Giới thiệu",
                        clause=f"Phần {chunk_counter}",
                        page_number=page_number,
                    )
                    chunks.append(
                        DocumentChunk(
                            chunk_id=f"{doc_id}_chunk_{chunk_counter:04d}",
                            text=enriched_preamble,
                            embedding=None,
                            metadata=meta,
                        )
                    )
                    chunk_counter += 1

        # Iterate over each Article block
        for i, match in enumerate(article_matches):
            art_start = match.start()
            art_end = (
                article_matches[i + 1].start()
                if i + 1 < len(article_matches)
                else len(clean_text)
            )
            article_full_text = clean_text[art_start:art_end].strip()
            article_header = match.group(1).strip()

            # Identify parent Chapter (search backwards from current article position)
            preceding_text = clean_text[:art_start]
            chapter_matches = list(self.CHAPTER_PATTERN.finditer(preceding_text))
            current_chapter = (
                chapter_matches[-1].group(1).strip() if chapter_matches else ""
            )

            # Extract article title and body
            lines = article_full_text.split("\n", 1)
            article_body = lines[1].strip() if len(lines) > 1 else ""

            # Extract article code (e.g., "Điều 5")
            article_num_match = re.search(r"(?i)(Điều\s+\d+)", article_header)
            article_code = article_num_match.group(1) if article_num_match else article_header

            # Construct enriched context header
            header_components = [c for c in [base_title, current_chapter, article_header] if c]
            context_prefix = " > ".join(header_components)

            # If article is small enough, keep as single chunk
            if len(article_full_text) <= self.chunk_size:
                enriched_content = f"[{context_prefix}]\n{article_full_text}"
                meta = DocumentMetadata(
                    doc_id=doc_id,
                    filename=filename,
                    title=f"{current_chapter} - {article_header}" if current_chapter else article_header,
                    article=article_code,
                    clause=None,
                    page_number=page_number,
                )
                chunks.append(
                    DocumentChunk(
                        chunk_id=f"{doc_id}_chunk_{chunk_counter:04d}",
                        text=enriched_content,
                        embedding=None,
                        metadata=meta,
                    )
                )
                chunk_counter += 1
                continue

            # If article exceeds chunk_size, split by Clauses (Khoản)
            clause_matches = list(self.CLAUSE_PATTERN.finditer(article_body))
            if clause_matches:
                for c_idx, c_match in enumerate(clause_matches):
                    c_start = c_match.start()
                    c_end = (
                        clause_matches[c_idx + 1].start()
                        if c_idx + 1 < len(clause_matches)
                        else len(article_body)
                    )
                    clause_text = article_body[c_start:c_end].strip()
                    clause_num = c_match.group(1) or c_match.group(2) or str(c_idx + 1)
                    clause_title = f"Khoản {clause_num}"

                    clause_header_prefix = f"{context_prefix} > {clause_title}"

                    if len(clause_text) <= self.chunk_size:
                        enriched_clause = f"[{clause_header_prefix}]\n{clause_text}"
                        meta = DocumentMetadata(
                            doc_id=doc_id,
                            filename=filename,
                            title=f"{article_header} - {clause_title}",
                            article=article_code,
                            clause=clause_title,
                            page_number=page_number,
                        )
                        chunks.append(
                            DocumentChunk(
                                chunk_id=f"{doc_id}_chunk_{chunk_counter:04d}",
                                text=enriched_clause,
                                embedding=None,
                                metadata=meta,
                            )
                        )
                        chunk_counter += 1
                    else:
                        # Fallback for very long clause
                        sub_chunks = self.fallback_splitter.split_text(clause_text)
                        for sub_idx, sub_piece in enumerate(sub_chunks, start=1):
                            enriched_sub = (
                                f"[{clause_header_prefix} (Phần {sub_idx})]\n{sub_piece}"
                            )
                            meta = DocumentMetadata(
                                doc_id=doc_id,
                                filename=filename,
                                title=f"{article_header} - {clause_title} (Phần {sub_idx})",
                                article=article_code,
                                clause=clause_title,
                                page_number=page_number,
                            )
                            chunks.append(
                                DocumentChunk(
                                    chunk_id=f"{doc_id}_chunk_{chunk_counter:04d}",
                                    text=enriched_sub,
                                    embedding=None,
                                    metadata=meta,
                                )
                            )
                            chunk_counter += 1
            else:
                # Article has no numbered clauses but exceeds chunk_size
                sub_chunks = self.fallback_splitter.split_text(article_body)
                for sub_idx, sub_piece in enumerate(sub_chunks, start=1):
                    enriched_sub = f"[{context_prefix} (Phần {sub_idx})]\n{sub_piece}"
                    meta = DocumentMetadata(
                        doc_id=doc_id,
                        filename=filename,
                        title=f"{article_header} (Phần {sub_idx})",
                        article=article_code,
                        clause=None,
                        page_number=page_number,
                    )
                    chunks.append(
                        DocumentChunk(
                            chunk_id=f"{doc_id}_chunk_{chunk_counter:04d}",
                            text=enriched_sub,
                            embedding=None,
                            metadata=meta,
                        )
                    )
                    chunk_counter += 1

        logger.info(
            "Document '%s' (doc_id=%s) split into %d structured chunks",
            filename,
            doc_id,
            len(chunks),
        )
        return chunks
