"""Setup and verify local MongoDB instance for NTU EduBot."""
import sys
from datetime import datetime, timezone
import pymongo
from pymongo import MongoClient

# Configure UTF-8 output for Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "ntu_edubot_db"
VECTOR_COLLECTION = "document_chunks"
CHAT_COLLECTION = "chat_histories"


def setup_local_mongodb():
    """Connect to local MongoDB, initialize collections, and create indexes."""
    print("=" * 60)
    print("NTU EduBot - Khởi tạo Cơ sở dữ liệu MongoDB Local (Compass)")
    print("=" * 60)
    print(f"[*] Đang kết nối tới: {MONGO_URI}...")

    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=4000)
        client.admin.command("ping")
        print("[✓] Kết nối tới MongoDB Local thành công!")
    except Exception as exc:
        print(f"[✗] Không thể kết nối tới MongoDB tại {MONGO_URI}.")
        print(f"    Chi tiết lỗi: {exc}")
        print("    Vui lòng đảm bảo MongoDB Server/Compass Service đang chạy.")
        sys.exit(1)

    db = client[DB_NAME]
    existing_collections = db.list_collection_names()
    print(f"[*] Database: '{DB_NAME}'")

    # 1. Initialize document_chunks collection
    if VECTOR_COLLECTION not in existing_collections:
        db.create_collection(VECTOR_COLLECTION)
        print(f"[+] Đã tạo collection: '{VECTOR_COLLECTION}'")
    else:
        print(f"[i] Collection '{VECTOR_COLLECTION}' đã tồn tại.")

    chunks_coll = db[VECTOR_COLLECTION]
    # Create indexes for document_chunks
    chunks_coll.create_index([("metadata.doc_id", pymongo.ASCENDING)], name="idx_metadata_doc_id")
    chunks_coll.create_index([("chunk_id", pymongo.ASCENDING)], unique=True, name="idx_chunk_id")
    print(f"[✓] Đã thiết lập Index cho '{VECTOR_COLLECTION}': 'metadata.doc_id' và 'chunk_id' (unique).")

    # 2. Initialize chat_histories collection
    if CHAT_COLLECTION not in existing_collections:
        db.create_collection(CHAT_COLLECTION)
        print(f"[+] Đã tạo collection: '{CHAT_COLLECTION}'")
    else:
        print(f"[i] Collection '{CHAT_COLLECTION}' đã tồn tại.")

    chat_coll = db[CHAT_COLLECTION]
    # Create indexes for chat_histories
    chat_coll.create_index([("session_id", pymongo.ASCENDING)], name="idx_session_id")
    chat_coll.create_index(
        [("session_id", pymongo.ASCENDING), ("timestamp", pymongo.ASCENDING)],
        name="idx_session_timestamp",
    )
    print(f"[✓] Đã thiết lập Index cho '{CHAT_COLLECTION}': 'session_id' và compound 'session_id + timestamp'.")

    # 3. Local collections are ready
    print(f"[✓] Collections '{VECTOR_COLLECTION}' và '{CHAT_COLLECTION}' đã sẵn sàng trong database '{DB_NAME}'.")

    print("\n" + "=" * 60)
    print("HOÀN TẤT THIẾT LẬP MONGODB LOCAL CHO NTU EDUBOT!")
    print(f"Cơ sở dữ liệu: {DB_NAME}")
    print(f"Collections:   {db.list_collection_names()}")
    print("Mở MongoDB Compass và làm mới (Refresh) để xem database 'ntu_edubot_db'.")
    print("=" * 60)


if __name__ == "__main__":
    setup_local_mongodb()
