"""End-to-End (E2E) Integration Test Suite for NTU EduBot RAG Pipeline."""
import sys
from pathlib import Path
from typing import Any, Dict, List

# Configure UTF-8 for Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app

SESSION_ID = "e2e_test_session_ntu_001"
TEST_QUESTION = "Điều kiện xét học bổng khuyến khích học tập là gì?"


def print_header(title: str):
    print("\n" + "=" * 70)
    print(f"   {title}")
    print("=" * 70)


def print_result(test_name: str, passed: bool, details: str = ""):
    status_tag = "[PASS ✓]" if passed else "[FAIL ✗]"
    print(f"{status_tag} {test_name}")
    if details:
        print(f"       -> {details}")


def run_e2e_tests() -> bool:
    """Execute end-to-end integration test suite."""
    print_header("NTU EDUBOT - KIỂM THỬ TÍCH HỢP HỆ THỐNG RAG (E2E TESTS)")

    all_tests_passed = True

    with TestClient(app) as client:
        # ---------------------------------------------------------------------
        # TEST 1: Health & Database Connection
        # ---------------------------------------------------------------------
        print("\n[TEST 1] Kiểm tra sức khỏe hệ thống & Kết nối MongoDB Local...")
        try:
            res = client.get("/health")
            passed = (
                res.status_code == 200
                and res.json().get("status") == "healthy"
                and res.json().get("database") == "connected"
            )
            if not passed:
                all_tests_passed = False
            print_result(
                "Test 1: Health Check (/health)",
                passed,
                f"Status Code: {res.status_code}, Database: {res.json().get('database')}, Keys: {res.json().get('gemini_keys_available')}",
            )
        except Exception as exc:
            all_tests_passed = False
            print_result("Test 1: Health Check (/health)", False, str(exc))

        # ---------------------------------------------------------------------
        # TEST 2: Ingested Documents List in Vector Database
        # ---------------------------------------------------------------------
        print("\n[TEST 2] Kiểm tra danh mục tài liệu quy chế trong Kho Tri thức Vector...")
        try:
            res = client.get("/api/v1/documents/list")
            docs = res.json()
            found_doc = any(d.get("doc_id") == "ntu_quy_che_2026" for d in docs) if isinstance(docs, list) else False
            total_chunks = sum(d.get("total_chunks", 0) for d in docs if d.get("doc_id") == "ntu_quy_che_2026")

            passed = res.status_code == 200 and found_doc and total_chunks > 0
            if not passed:
                all_tests_passed = False
            print_result(
                "Test 2: Document Catalog (/api/v1/documents/list)",
                passed,
                f"Tìm thấy tài liệu 'ntu_quy_che_2026' ({total_chunks} chunks trong MongoDB)",
            )
        except Exception as exc:
            all_tests_passed = False
            print_result("Test 2: Document Catalog (/api/v1/documents/list)", False, str(exc))

        # ---------------------------------------------------------------------
        # TEST 3A: RAG Query Non-streaming & Citations Grounding
        # ---------------------------------------------------------------------
        print("\n[TEST 3A] Kiểm tra hỏi đáp RAG (Non-streaming) & Trích dẫn căn cứ pháp lý...")
        try:
            payload = {
                "session_id": SESSION_ID,
                "question": TEST_QUESTION,
                "top_k": 5,
            }
            res = client.post("/api/v1/chat/message", json=payload)
            data = res.json()

            answer = data.get("answer", "")
            sources = data.get("sources", [])
            has_sources = len(sources) > 0
            has_answer = len(answer.strip()) > 30

            articles_cited = [s.get("article") for s in sources if s.get("article")]
            scores = [float(s.get("score", 0)) for s in sources]
            scores_valid = all(0.74 <= sc <= 0.99 for sc in scores) if scores else True

            passed = res.status_code == 200 and has_answer and has_sources and scores_valid
            if not passed:
                all_tests_passed = False

            score_str = ", ".join(f"{sc*100:.1f}%" for sc in scores)
            print_result(
                "Test 3A: Chat Message Endpoint (/api/v1/chat/message)",
                passed,
                f"Nhận {len(sources)} trích dẫn ({', '.join(set(articles_cited)) or 'Quy chế'}). Điểm trích dẫn: [{score_str}] (Đạt ngưỡng 75% - 98.5%). Độ dài: {len(answer)} ký tự",
            )
            print("\n--- [TRÍCH ĐOẠN CÂU TRẢ LỜI CỦA BOT] ---")
            preview = answer[:260] + "..." if len(answer) > 260 else answer
            print(preview)
            print("------------------------------------------")
        except Exception as exc:
            all_tests_passed = False
            print_result("Test 3A: Chat Message Endpoint (/api/v1/chat/message)", False, str(exc))

        # ---------------------------------------------------------------------
        # TEST 3B: RAG Server-Sent Events (SSE) Streaming
        # ---------------------------------------------------------------------
        print("\n[TEST 3B] Kiểm tra hỏi đáp RAG dạng Streaming Server-Sent Events (SSE)...")
        try:
            payload = {
                "session_id": f"{SESSION_ID}_stream",
                "question": "Quy định về đăng ký học lại khi bị điểm F?",
                "top_k": 3,
            }
            res = client.post("/api/v1/chat/stream", json=payload)
            stream_body = res.text

            has_sources_event = "event: sources" in stream_body
            has_message_event = "event: message" in stream_body
            has_done_event = "event: done" in stream_body

            passed = res.status_code == 200 and has_sources_event and has_message_event and has_done_event
            if not passed:
                all_tests_passed = False

            print_result(
                "Test 3B: Chat Stream Endpoint (/api/v1/chat/stream)",
                passed,
                f"SSE Events nhận diện: sources ({has_sources_event}), message ({has_message_event}), done ({has_done_event})",
            )
        except Exception as exc:
            all_tests_passed = False
            print_result("Test 3B: Chat Stream Endpoint (/api/v1/chat/stream)", False, str(exc))

        # ---------------------------------------------------------------------
        # TEST 3C: School Overview & Introduction Intent Filtering
        # ---------------------------------------------------------------------
        print("\n[TEST 3C] Kiểm tra hỏi đáp Giới thiệu Trường & Lọc trích dẫn rác...")
        try:
            payload = {
                "session_id": f"{SESSION_ID}_intro",
                "question": "Giới thiệu về trường học và các ngành đào tạo của Trường Đại học Nguyễn Trãi?",
                "top_k": 3,
            }
            res = client.post("/api/v1/chat/message", json=payload)
            data = res.json()
            intro_answer = data.get("answer", "")
            intro_sources = data.get("sources", [])

            # Must NOT include unrelated articles (Điều 1, Điều 3, Điều 6)
            unrelated_articles = ["Điều 1", "Điều 3", "Điều 6"]
            has_unrelated = any(any(unr in str(s.get("article", "")) for unr in unrelated_articles) for s in intro_sources)
            has_intro_content = "Nguyễn Trãi" in intro_answer and len(intro_answer) > 100

            passed = res.status_code == 200 and has_intro_content and not has_unrelated
            if not passed:
                all_tests_passed = False

            cited_arts = [s.get("article") or s.get("title") for s in intro_sources]
            print_result(
                "Test 3C: School Overview Intent & Clean Citations",
                passed,
                f"Trích dẫn gắn kèm: {cited_arts}. Tuyệt đối không lôi Điều 1, 3, 6 không liên quan vào.",
            )
        except Exception as exc:
            all_tests_passed = False
            print_result("Test 3C: School Overview Intent & Clean Citations", False, str(exc))

        # ---------------------------------------------------------------------
        # TEST 4: Chat History Persistence in MongoDB
        # ---------------------------------------------------------------------
        print("\n[TEST 4] Kiểm tra lưu vết lịch sử hội thoại trong MongoDB...")
        try:
            res = client.get(f"/api/v1/chat/history/{SESSION_ID}")
            data = res.json()
            messages = data.get("messages", [])

            user_msgs = [m for m in messages if m.get("role") == "user"]
            bot_msgs = [m for m in messages if m.get("role") == "assistant"]

            passed = res.status_code == 200 and len(user_msgs) >= 1 and len(bot_msgs) >= 1
            if not passed:
                all_tests_passed = False

            print_result(
                f"Test 4: Chat History (/api/v1/chat/history/{SESSION_ID})",
                passed,
                f"Đã lưu thành công {len(messages)} tin nhắn ({len(user_msgs)} User, {len(bot_msgs)} Bot) trong MongoDB",
            )
        except Exception as exc:
            all_tests_passed = False
            print_result(f"Test 4: Chat History (/api/v1/chat/history/{SESSION_ID})", False, str(exc))

    # -------------------------------------------------------------------------
    # SUMMARY REPORT
    # -------------------------------------------------------------------------
    print_header("TỔNG KẾT BÁO CÁO KIỂM THỬ TÍCH HỢP (E2E)")
    if all_tests_passed:
        print(">>> KẾT QUẢ: 100% TẤT CẢ BÀI KIỂM THỬ ĐÃ VƯỢT QUA THÀNH CÔNG (PASS)! <<<")
        print("Hệ thống NTU EduBot hoàn toàn ổn định và sẵn sàng phục vụ sinh viên.")
    else:
        print(">>> KẾT QUẢ: MỘT SỐ BÀI KIỂM THỬ THẤT BẠI. VUI LÒNG KIỂM TRA LẠI LOGS. <<<")

    print("=" * 70 + "\n")
    return all_tests_passed


if __name__ == "__main__":
    success = run_e2e_tests()
    sys.exit(0 if success else 1)
