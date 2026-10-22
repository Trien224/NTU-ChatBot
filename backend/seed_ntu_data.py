"""Seed and ingest NTU Academic Regulations sample data into MongoDB."""
import asyncio
import hashlib
import math
import sys
from pathlib import Path
from typing import Any, Dict, List

# Reconfigure stdout for UTF-8 display on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add backend directory to sys.path
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from app.core.config import settings
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.db.repositories.vector_repo import VectorRepository
from app.services.ai.embedding import embedding_service, generate_pseudo_embedding
from app.utils.text_splitter import RegExTextSplitter

SAMPLE_FILE_PATH = CURRENT_DIR / "data_sample" / "quy_che_dao_tao_ntu.txt"
DOC_ID = "ntu_quy_che_2026"
DOC_FILENAME = "quy_che_dao_tao_ntu.txt"
DOC_TITLE = "Quy chế Đào tạo trình độ Đại học - Đại học Nguyễn Trãi"


async def seed_data():
    """Main ingestion routine for NTU regulations dataset."""
    print("=" * 70)
    print("   NTU EDUBOT - TỰ ĐỘNG NẠP BỘ DỮ LIỆU MẪU QUY CHẾ HỌC VỤ NTU")
    print("=" * 70)

    # 1. Connect to MongoDB
    print("\n[1/5] Đang kết nối tới cơ sở dữ liệu MongoDB...")
    await connect_to_mongo()
    db = get_database()
    vector_repo = VectorRepository()
    print("[✓] Kết nối cơ sở dữ liệu thành công!")

    # 2. Check and read sample file
    print(f"\n[2/5] Đang đọc file tài liệu: {SAMPLE_FILE_PATH}...")
    if not SAMPLE_FILE_PATH.exists():
        print(f"[✗] Không tìm thấy file tại: {SAMPLE_FILE_PATH}")
        await close_mongo_connection()
        sys.exit(1)

    raw_text = SAMPLE_FILE_PATH.read_text(encoding="utf-8")
    print(f"[✓] Đọc thành công ({len(raw_text):,} ký tự).")

    # 3. Clean up existing chunks, garbage files, and erroneous chat history
    print(f"\n[3/5] Dọn dẹp dữ liệu cũ của doc_id='{DOC_ID}', xóa file rác & lịch sử lỗi...")
    purge_result = await vector_repo.collection.delete_many({
        "$or": [
            {"chunk_id": "__init_system_marker__"},
            {"metadata.filename": "init_system.txt"},
            {"metadata.filename": {"$regex": "huong_dan_dich_vu", "$options": "i"}},
            {"metadata.doc_id": "__init__"},
            {"metadata.doc_id": {"$regex": "huong_dan", "$options": "i"}},
            {"metadata.title": {"$regex": "Bản ghi khởi tạo", "$options": "i"}},
            {"text": {"$regex": "Bản ghi khởi tạo", "$options": "i"}},
            {"text": {"$regex": "System Initialization Marker", "$options": "i"}},
        ]
    })
    if purge_result.deleted_count > 0:
        print(f"[✓] Đã xóa vĩnh viễn {purge_result.deleted_count} bản ghi rác khỏi collection 'document_chunks'.")

    # Clean old faulty chat histories (low scores, fallback error messages)
    chat_coll = db[settings.CHAT_COLLECTION]
    chat_purge = await chat_coll.delete_many({
        "$or": [
            {"messages.content": {"$regex": "tài liệu quy chế học vụ hiện hành.*chưa có quy định", "$options": "i"}},
            {"messages.sources.score": {"$lt": 0.25}},
            {"messages.sources.score": {"$regex": "^0.0"}},
        ]
    })
    if chat_purge.deleted_count > 0:
        print(f"[✓] Đã xóa {chat_purge.deleted_count} phiên lịch sử chat bị lỗi/điểm thấp trong MongoDB.")

    deleted_count = await vector_repo.delete_by_doc_id(DOC_ID)
    if deleted_count > 0:
        print(f"[i] Đã xóa {deleted_count} chunks cũ để nạp mới hoàn toàn.")
    else:
        print("[i] Không có dữ liệu cũ cần xóa. Sẵn sàng nạp mới.")

    # 4. Split document using RegExTextSplitter with legal hierarchy
    print("\n[4/5] Đang phân tích cú pháp Chương/Điều/Khoản và Metadata Enrichment...")
    splitter = RegExTextSplitter(chunk_size=800, chunk_overlap=100)
    chunks = splitter.split_document(
        text=raw_text,
        doc_id=DOC_ID,
        filename=DOC_FILENAME,
        base_title=DOC_TITLE,
    )
    print(f"[✓] Đã tạo thành công {len(chunks)} chunks có cấu trúc pháp lý phong phú.")

    # 5. Generate Vector Embeddings
    print("\n[5/5] Đang tạo Vector Embeddings (768 chiều)...")
    chunk_texts = [c.text for c in chunks]

    embeddings: List[List[float]] = []
    is_real_embedding = True

    try:
        embeddings = await embedding_service.get_embeddings(chunk_texts)
        if not embeddings or len(embeddings) != len(chunks):
            raise ValueError("Số lượng vector trả về không khớp số lượng chunks.")
        print("[✓] Sinh Embeddings thành công qua mô hình Google text-embedding-004!")
    except Exception as exc:
        is_real_embedding = False
        print(f"[!] Cảnh báo: Gọi API Gemini thất bại ({exc}).")
        print("[*] Đang kích hoạt cơ chế Fallback: Tạo deterministic pseudo-embeddings 768D...")
        embeddings = [generate_pseudo_embedding(t) for t in chunk_texts]
        print(f"[✓] Đã tạo {len(embeddings)} vectors chuẩn hóa 768 chiều cho toàn bộ chunks!")

    # Assign embeddings and prepare documents for insertion
    chunk_documents: List[Dict[str, Any]] = []
    for chunk, emb in zip(chunks, embeddings):
        chunk.embedding = emb
        chunk_documents.append(chunk.model_dump())

    # Insert into MongoDB
    inserted_count = await vector_repo.insert_chunks(chunk_documents)
    print(f"\n[✓] Đã lưu thành công {inserted_count} chunks vào collection 'document_chunks'!")

    # Print summary table
    print("\n" + "=" * 70)
    print("                    BẢNG THỐNG KÊ CHI TIẾT DỮ LIỆU ĐÃ NẠP")
    print("=" * 70)
    print(f"{'STT':<4} | {'Mã Chunk':<24} | {'Điều / Căn cứ':<18} | {'Khoản / Tiêu đề'}")
    print("-" * 70)

    for idx, c in enumerate(chunks, start=1):
        article_str = str(c.metadata.article or "Mở đầu")
        clause_str = str(c.metadata.clause or c.metadata.title or "")
        # Truncate if long
        if len(clause_str) > 28:
            clause_str = clause_str[:25] + "..."
        print(f"{idx:<4} | {c.chunk_id:<24} | {article_str:<18} | {clause_str}")

    print("=" * 70)
    print("TỔNG KẾT:")
    print(f" - Tài liệu:        {DOC_TITLE}")
    print(f" - Mã tài liệu:     {DOC_ID}")
    print(f" - Tổng số chunks:  {inserted_count}")
    print(f" - Loại Vector:     {'Gemini text-embedding-004 (Real)' if is_real_embedding else 'Deterministic Pseudo-Vector 768D (Fallback)'}")
    print(f" - Database:        ntu_edubot_db")
    print(f" - Collection:      document_chunks")
    print("=" * 70)
    print("\n>>> DỮ LIỆU ĐÃ SẴN SÀNG! Bạn có thể test hỏi đáp RAG ngay trên http://localhost:8000! <<<")

    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(seed_data())
