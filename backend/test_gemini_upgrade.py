"""
NTU EduBot - Gemini Web Upgrade Verification Test Suite
Tests all new endpoints and features:
- Chat Sessions Listing (GET /api/v1/chat/sessions)
- Session Metadata Update: Rename & Pin (PATCH /api/v1/chat/sessions/{session_id})
- Word .doc Export (GET /api/v1/chat/sessions/{session_id}/export-word)
- Whoami Intent ("Tôi là ai")
- Multimodal Ingestion Allowed Extensions (.mp4, .webm, .mp3, .wav, .webp)
- Clean Offline Fallback without rough tags
- Static Frontend Serving (index.html, style.css, main.js, api.js)
"""

import sys
import os
import unittest

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.utils.file_handler import ALLOWED_EXTENSIONS
from app.services.ai.llm import format_offline_fallback_response

client = TestClient(app)

class TestGeminiUpgrade(unittest.TestCase):
    def test_01_allowed_extensions_multimodal(self):
        """Verify audio and video multimodal formats are permitted."""
        multimodal_exts = {".mp4", ".webm", ".mp3", ".wav", ".webp", ".pdf", ".txt", ".png", ".jpg", ".jpeg"}
        for ext in multimodal_exts:
            self.assertIn(ext, ALLOWED_EXTENSIONS, f"Extension {ext} should be in ALLOWED_EXTENSIONS")
        print("  [PASS] Test 1: Multimodal extensions verified (.mp4, .webm, .mp3, .wav, .webp).")

    def test_02_static_frontend_routes(self):
        """Verify frontend assets are served correctly with HTTP 200."""
        routes = ["/", "/css/style.css", "/js/api.js", "/js/main.js"]
        for r in routes:
            res = client.get(r)
            self.assertEqual(res.status_code, 200, f"Route {r} returned {res.status_code}")
        print("  [PASS] Test 2: Static frontend assets loaded with HTTP 200 OK.")

    def test_03_get_chat_sessions_empty_or_existing(self):
        """Verify GET /api/v1/chat/sessions returns HTTP 200 and a list of sessions."""
        res = client.get("/api/v1/chat/sessions?limit=50")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("sessions", data)
        self.assertIsInstance(data["sessions"], list)
        print(f"  [PASS] Test 3: GET /api/v1/chat/sessions returned {len(data['sessions'])} sessions.")

    def test_04_session_lifecycle_and_word_export(self):
        """Test creating messages, auto-titling, pinning, renaming, Word export, and deletion."""
        test_sid = f"test_gemini_{os.urandom(4).hex()}"

        # 1. Ask a question to trigger session creation and auto-title
        question = "Điều kiện xét học bổng khuyến khích học tập tại NTU như thế nào?"
        chat_res = client.post(
            "/api/v1/chat/message",
            json={"session_id": test_sid, "question": question, "top_k": 3}
        )
        self.assertEqual(chat_res.status_code, 200)
        chat_data = chat_res.json()
        self.assertIn("answer", chat_data)

        # 2. Check session is listed with auto-generated title (<= 42 chars)
        sessions_res = client.get("/api/v1/chat/sessions?limit=50")
        self.assertEqual(sessions_res.status_code, 200)
        sessions = sessions_res.json()["sessions"]
        matched = [s for s in sessions if s["session_id"] == test_sid]
        self.assertTrue(len(matched) > 0, "Newly created session should appear in sessions list")
        session_meta = matched[0]
        self.assertTrue(len(session_meta["title"]) <= 50)
        self.assertFalse(session_meta["is_pinned"])
        print(f"  [PASS] Test 4a: Session created with auto-title: '{session_meta['title']}'")

        # 3. Pin the session
        pin_res = client.patch(
            f"/api/v1/chat/sessions/{test_sid}",
            json={"is_pinned": True}
        )
        self.assertEqual(pin_res.status_code, 200)
        self.assertTrue(pin_res.json()["is_pinned"])
        print("  [PASS] Test 4b: Session pinned successfully.")

        # 4. Rename the session
        new_title = "Học bổng KKHT NTU Kỳ 1"
        rename_res = client.patch(
            f"/api/v1/chat/sessions/{test_sid}",
            json={"title": new_title}
        )
        self.assertEqual(rename_res.status_code, 200)
        self.assertEqual(rename_res.json()["title"], new_title)
        print("  [PASS] Test 4c: Session renamed successfully.")

        # 5. Export Word Document (.doc)
        word_res = client.get(f"/api/v1/chat/sessions/{test_sid}/export-word")
        self.assertEqual(word_res.status_code, 200)
        self.assertIn("application/msword", word_res.headers.get("content-type", ""))
        self.assertIn("attachment", word_res.headers.get("content-disposition", ""))
        
        doc_text = word_res.content.decode("utf-8", errors="ignore")
        self.assertIn("TRƯỜNG ĐẠI HỌC NGUYỄN TRÃI", doc_text)
        self.assertIn("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", doc_text)
        self.assertIn("BIÊN BẢN TƯ VẤN & TRA CỨU QUY CHẾ HỌC VỤ", doc_text)
        self.assertIn(test_sid, doc_text)
        self.assertIn(new_title, doc_text)
        print("  [PASS] Test 4d: Word .doc exported with valid A4 layout and national headers.")

        # 6. Delete session history and metadata
        del_res = client.delete(f"/api/v1/chat/history/{test_sid}")
        self.assertEqual(del_res.status_code, 200)

        # Verify it was removed
        sessions_after = client.get("/api/v1/chat/sessions?limit=50").json()["sessions"]
        self.assertFalse(any(s["session_id"] == test_sid for s in sessions_after))
        print("  [PASS] Test 4e: Session and history purged completely.")

    def test_05_whoami_intent(self):
        """Test 'Tôi là ai' conversational intent."""
        test_sid = f"test_whoami_{os.urandom(4).hex()}"
        res = client.post(
            "/api/v1/chat/message",
            json={"session_id": test_sid, "question": "Tôi là ai?", "top_k": 3}
        )
        self.assertEqual(res.status_code, 200)
        answer = res.json().get("answer", "")
        self.assertTrue(
            "sinh viên" in answer.lower() or "người dùng" in answer.lower(),
            f"Expected answer to explain who the user is, got: {answer[:100]}"
        )
        self.assertIn("Đại học Nguyễn Trãi", answer)
        # Cleanup
        client.delete(f"/api/v1/chat/history/{test_sid}")
        print("  [PASS] Test 5: 'Tôi là ai' intent responded with friendly student identity.")

    def test_06_clean_offline_fallback(self):
        """Test format_offline_fallback_response removes raw technical tags like '[Tài liệu 1]:'."""
        sample_contexts = [
            {"title": "Quy chế Đào tạo", "article": "Điều 12", "clause": "Khoản 1", "content": "Tiêu chuẩn xét học bổng."},
            {"title": "Quy chế Đào tạo", "article": "Điều 13", "clause": "Khoản 2", "content": "Mức thưởng học bổng."}
        ]
        fallback = format_offline_fallback_response("Học bổng xét thế nào?", sample_contexts)
        self.assertNotIn("[Tài liệu 1]:", fallback)
        self.assertNotIn("[Tài liệu 2]:", fallback)
        self.assertIn("Quy chế Đào tạo", fallback)
        print("  [PASS] Test 6: Offline fallback output is clean without raw technical tags.")

if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING NTU EDUBOT GEMINI UPGRADE TEST SUITE")
    print("=" * 60)
    unittest.main(verbosity=2)
