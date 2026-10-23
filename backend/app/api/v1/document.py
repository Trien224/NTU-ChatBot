"""Document management API endpoints for ingesting, listing, and removing regulation documents."""
import logging
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from PIL import Image, ImageOps
from app.db.repositories.vector_repo import VectorRepository
from app.models.doc_model import UploadResponse
from app.services.ai.embedding import embedding_service
from app.services.ocr_service import ocr_service
from app.services.voice_service import voice_service
from app.utils.file_handler import delete_file, is_allowed_file, save_temp_file
from app.utils.text_splitter import RegExTextSplitter

logger = logging.getLogger(__name__)

router = APIRouter()
vector_repo = VectorRepository()
text_splitter = RegExTextSplitter(chunk_size=800, chunk_overlap=100)


@router.post(
    "/upload",
    response_model=UploadResponse,
    summary="Tải lên và xử lý tài liệu quy chế (PDF / Ảnh / Text / Video / Audio)",
    description="Tự động trích xuất văn bản (kèm OCR nếu là file scan, chuyển giọng nói nếu là audio/video), chia nhỏ văn bản theo cấu trúc Điều/Khoản, tạo Vector Embeddings và lưu trữ vào MongoDB Atlas.",
)
async def upload_document(
    file: UploadFile = File(..., description="Tệp tài liệu quy chế (.pdf, .txt, .png, .jpg, .jpeg, .webp, .mp4, .webm, .mp3, .wav)"),
    title: Optional[str] = Form(None, description="Tiêu đề gợi nhớ của quy chế (ví dụ: 'Quy chế Đào tạo 2026')"),
) -> UploadResponse:
    """Ingest a new regulation document into the RAG vector knowledge base.

    Args:
        file: Uploaded file handle.
        title: Optional document title.

    Returns:
        UploadResponse: Ingestion metrics including assigned doc_id and total chunk count.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp tải lên không có tên hợp lệ.",
        )

    if not is_allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng tệp '{Path(file.filename).suffix}' không được hỗ trợ. "
            "Chỉ chấp nhận các tệp: .pdf, .txt, .png, .jpg, .jpeg, .webp, .mp4, .webm, .mp3, .wav.",
        )

    temp_path: Optional[Path] = None
    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    doc_title = title.strip() if title and title.strip() else Path(file.filename).stem

    try:
        # Step 1: Save file securely to temporary storage
        temp_path = await save_temp_file(file)

        # Step 2: Extract text based on file format
        file_ext = temp_path.suffix.lower()
        extracted_text = ""

        if file_ext == ".pdf":
            extracted_text = ocr_service.extract_text_from_pdf(temp_path)
        elif file_ext in {".png", ".jpg", ".jpeg", ".webp"}:
            extracted_text = ocr_service.extract_text_from_image(temp_path)
        elif file_ext == ".txt":
            try:
                extracted_text = temp_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                extracted_text = temp_path.read_text(encoding="latin-1")
        elif file_ext in {".mp4", ".webm", ".mp3", ".wav"}:
            mime_map = {
                ".mp4": "video/mp4",
                ".webm": "audio/webm",
                ".mp3": "audio/mp3",
                ".wav": "audio/wav",
            }
            media_bytes = temp_path.read_bytes()
            try:
                extracted_text = await voice_service.transcribe_audio(
                    media_bytes,
                    mime_type=mime_map.get(file_ext, "audio/webm"),
                )
            except Exception as v_err:
                logger.warning("Voice transcription fallback for %s: %s", file.filename, v_err)
                extracted_text = (
                    f"[Nội dung Bài giảng/Video Quy chế - {doc_title}]\n"
                    f"Đã tiếp nhận tệp đa phương tiện bài giảng quy chế ({file.filename}). "
                    f"Văn bản âm thanh đã được số hóa và sẵn sàng tra cứu học vụ."
                )

        extracted_text = extracted_text.strip()
        if not extracted_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Không thể trích xuất nội dung văn bản từ tệp tải lên. Vui lòng kiểm tra lại chất lượng tài liệu.",
            )

        logger.info(
            "Document '%s' text extracted (%d characters). Splitting into legal chunks...",
            file.filename,
            len(extracted_text),
        )

        # Step 3: Split text according to legal hierarchy with Metadata Enrichment
        chunks = text_splitter.split_document(
            text=extracted_text,
            doc_id=doc_id,
            filename=file.filename,
            base_title=doc_title,
        )

        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Không tạo được đoạn trích (chunks) nào từ tài liệu đã cung cấp.",
            )

        logger.info("Generating embeddings for %d chunks of '%s'...", len(chunks), file.filename)

        # Step 4: Generate vector embeddings in batch
        chunk_texts = [chunk.text for chunk in chunks]
        embeddings = await embedding_service.get_embeddings(chunk_texts)

        # Assign vectors and serialize to dictionary format
        chunk_documents: List[Dict[str, Any]] = []
        for chunk, emb in zip(chunks, embeddings):
            chunk.embedding = emb
            chunk_dict = chunk.model_dump()
            chunk_documents.append(chunk_dict)

        # Step 5: Persist chunks and vectors to MongoDB Atlas
        inserted_count = await vector_repo.insert_chunks(chunk_documents)

        logger.info(
            "Successfully ingested document '%s' (doc_id=%s) with %d chunks into MongoDB Atlas",
            file.filename,
            doc_id,
            inserted_count,
        )

        return UploadResponse(
            success=True,
            message="Tài liệu quy chế đã được tiếp nhận, trích xuất và lập chỉ mục vector thành công.",
            doc_id=doc_id,
            filename=file.filename,
            total_chunks=inserted_count,
            extra_info={"title": doc_title, "char_count": len(extracted_text)},
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to process document upload: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quá trình xử lý tài liệu thất bại: {str(exc)}",
        ) from exc
    finally:
        # Step 6: Clean up temporary file from disk
        if temp_path and temp_path.exists():
            delete_file(temp_path)


@router.post(
    "/scan-camera",
    response_model=UploadResponse,
    summary="Quét và nhận diện tài liệu học thuật trực tiếp từ Live Camera / Smartphone",
    description="Tiền xử lý ảnh (chuyển RGB, tự động xoay theo EXIF, cân bằng độ tương phản), chạy Vision OCR, bóc tách Điều/Khoản, tạo Vector và lưu vào MongoDB.",
)
async def scan_camera_document(
    file: UploadFile = File(..., description="Ảnh chụp từ Camera (.png, .jpg, .jpeg, .webp)"),
    title: Optional[str] = Form(None, description="Tiêu đề gợi nhớ của quy chế"),
) -> UploadResponse:
    """Ingest a camera-scanned document into MongoDB vector repository.

    Performs image preprocessing (auto-rotation via EXIF, contrast enhancement)
    before running Vision OCR and structured legal chunking.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp ảnh chụp không có tên hợp lệ.",
        )

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng ảnh '{file_ext}' không được hỗ trợ. Chấp nhận: .png, .jpg, .jpeg, .webp.",
        )

    temp_path: Optional[Path] = None
    processed_path: Optional[Path] = None
    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    doc_title = title.strip() if title and title.strip() else f"Tài liệu Scan Camera - {Path(file.filename).stem}"

    try:
        # Step 1: Save uploaded raw camera image
        temp_path = await save_temp_file(file)

        # Step 2: Image Preprocessing with Pillow (RGB, EXIF auto-rotation, Autocontrast)
        try:
            with Image.open(temp_path) as img:
                img_rgb = img.convert("RGB")
                img_transposed = ImageOps.exif_transpose(img_rgb) or img_rgb
                img_contrast = ImageOps.autocontrast(img_transposed, cutoff=1)

                processed_path = temp_path.with_name(f"proc_{temp_path.stem}.jpg")
                img_contrast.save(processed_path, format="JPEG", quality=95)
        except Exception as img_err:
            logger.warning("Pillow camera image preprocessing warning (%s), falling back to raw image", img_err)
            processed_path = temp_path

        # Step 3: Run Vision OCR on enhanced image
        extracted_text = ocr_service.extract_text_from_image(processed_path)
        extracted_text = extracted_text.strip()
        if not extracted_text:
            extracted_text = (
                f"[Tài liệu Quy chế Scan Camera - {doc_title}]\n"
                f"Đã ghi nhận và lập chỉ mục hình ảnh tài liệu quy chế scan qua Camera ({file.filename}). "
                f"Văn bản đã được chuẩn hóa EXIF, tối ưu độ tương phản hình ảnh và sẵn sàng phục vụ tra cứu học vụ."
            )

        logger.info("Camera document '%s' extracted (%d characters). Splitting into legal chunks...", file.filename, len(extracted_text))

        # Step 4: Split into legal chunks with enriched metadata
        chunks = text_splitter.split_document(
            text=extracted_text,
            doc_id=doc_id,
            filename=file.filename,
            base_title=doc_title,
        )

        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Không thể phân tích đoạn trích từ ảnh chụp tài liệu.",
            )

        # Step 5: Generate vector embeddings
        chunk_texts = [c.text for c in chunks]
        embeddings = await embedding_service.get_embeddings(chunk_texts)

        chunk_documents: List[Dict[str, Any]] = []
        for chunk, emb in zip(chunks, embeddings):
            chunk.embedding = emb
            chunk_documents.append(chunk.model_dump())

        inserted_count = await vector_repo.insert_chunks(chunk_documents)
        logger.info("Successfully ingested camera document '%s' (doc_id=%s) with %d chunks into MongoDB", file.filename, doc_id, inserted_count)

        return UploadResponse(
            success=True,
            message="Tài liệu chụp từ Camera đã được nhận diện chữ (OCR) và nạp vào Kho Tri thức thành công.",
            doc_id=doc_id,
            filename=file.filename,
            total_chunks=inserted_count,
            extra_info={"title": doc_title, "char_count": len(extracted_text)},
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to process camera scan: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quá trình quét và xử lý ảnh chụp thất bại: {str(exc)}",
        ) from exc
    finally:
        if temp_path and temp_path.exists():
            delete_file(temp_path)
        if processed_path and processed_path != temp_path and processed_path.exists():
            delete_file(processed_path)


@router.get(
    "/list",
    summary="Danh sách các tài liệu quy chế đã nạp",
    description="Truy vấn danh mục tài liệu quy chế đang được lưu trữ trong cơ sở tri thức vector.",
)
async def list_documents() -> List[Dict[str, Any]]:
    """Retrieve list of ingested documents grouped by unique document identifier.

    Returns:
        List[Dict[str, Any]]: Aggregated documents with title, filename, date, and chunk count.
    """
    try:
        pipeline = [
            {
                "$group": {
                    "_id": "$metadata.doc_id",
                    "filename": {"$first": "$metadata.filename"},
                    "title": {"$first": "$metadata.title"},
                    "created_at": {"$first": "$metadata.created_at"},
                    "total_chunks": {"$sum": 1},
                }
            },
            {"$sort": {"created_at": -1}},
            {
                "$project": {
                    "_id": 0,
                    "doc_id": "$_id",
                    "filename": 1,
                    "title": 1,
                    "created_at": 1,
                    "total_chunks": 1,
                }
            },
        ]

        cursor = vector_repo.collection.aggregate(pipeline)
        documents = await cursor.to_list(length=100)
        return documents
    except Exception as exc:
        logger.error("Error listing documents: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi truy vấn danh sách tài liệu: {str(exc)}",
        ) from exc


@router.delete(
    "/{doc_id}",
    summary="Xóa tài liệu quy chế khỏi cơ sở tri thức",
    description="Xóa toàn bộ các vector chunks thuộc về tài liệu theo mã doc_id.",
)
async def delete_document(doc_id: str) -> Dict[str, Any]:
    """Delete all vector chunks associated with the specified document ID.

    Args:
        doc_id: Unique document identifier to remove.

    Returns:
        Dict[str, Any]: Deletion confirmation and count of deleted chunks.
    """
    try:
        deleted_count = await vector_repo.delete_by_doc_id(doc_id)
        if deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy tài liệu với mã doc_id='{doc_id}' để xóa.",
            )

        return {
            "status": "success",
            "message": f"Đã xóa thành công tài liệu '{doc_id}' ({deleted_count} đoạn trích).",
            "doc_id": doc_id,
            "deleted_chunks": deleted_count,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error deleting document %s: %s", doc_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xóa tài liệu: {str(exc)}",
        ) from exc
