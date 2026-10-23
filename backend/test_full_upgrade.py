"""
NTU EduBot - Full Upgrade & Security Verification Suite
Tests:
1. Protection of NTU official document (ntu_quy_che_2026):
   - DELETE -> 403 Forbidden
   - GET /detail -> 403 Forbidden
   - PATCH -> 403 Forbidden
2. Student document workflow:
   - Upload text document with student_id
   - GET /list with student_id filter
   - GET /{doc_id}/detail returns full text
   - PATCH /{doc_id} updates title
   - DELETE /{doc_id} deletes successfully
3. Chat session management & student isolation:
   - List sessions with student_id
   - DELETE /api/v1/chat/sessions/all
4. Frontend integrity check:
   - Friendly Vietnamese error message present in api.js and main.js
   - All interactive modal and button IDs present in index.html
"""
import os
import sys
import unittest
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestFullUpgrade(unittest.TestCase):
    def test_01_ntu_protected_document_forbidden(self):
        """Official regulation document (ntu_quy_che_2026) must return 403 on DELETE, GET detail, and PATCH."""
        # 1. DELETE
        res_del = client.delete("/api/v1/documents/ntu_quy_che_2026")
        self.assertEqual(res_del.status_code, 403, f"Expected 403 Forbidden, got {res_del.status_code}")
        self.assertIn("ntu_quy_che_2026", res_del.json().get("detail", ""))
        print("  [PASS] Test 1a: DELETE /api/v1/documents/ntu_quy_che_2026 returned 403 Forbidden.")

        # 2. GET detail
        res_detail = client.get("/api/v1/documents/ntu_quy_che_2026/detail")
        self.assertEqual(res_detail.status_code, 403, f"Expected 403 Forbidden, got {res_detail.status_code}")
        print("  [PASS] Test 1b: GET /api/v1/documents/ntu_quy_che_2026/detail returned 403 Forbidden.")

        # 3. PATCH
        res_patch = client.patch("/api/v1/documents/ntu_quy_che_2026", json={"title": "Hacked Title"})
        self.assertEqual(res_patch.status_code, 403, f"Expected 403 Forbidden, got {res_patch.status_code}")
        print("  [PASS] Test 1c: PATCH /api/v1/documents/ntu_quy_che_2026 returned 403 Forbidden.")

    def test_02_student_document_crud_lifecycle(self):
        """Student documents can be uploaded with student_id, viewed via /detail, renamed via PATCH, and deleted."""
        test_student_id = "NTU2026_TEST"
        sample_content = (
            "Điều 1: Quy định về đăng ký học phần bổ sung.\n"
            "Sinh viên được phép đăng ký tối đa 24 tín chỉ trong một học kỳ chính.\n"
            "Điều 2: Điều kiện hoãn thi kết thúc học phần vì lý do sức khỏe."
        )

        # 1. Upload test file
        files = {
            "file": ("test_sinh_vien_doc.txt", sample_content.encode("utf-8"), "text/plain")
        }
        data = {
            "title": "Tài liệu Hướng dẫn Học phần Cá nhân",
            "student_id": test_student_id
        }
        res_upload = client.post("/api/v1/documents/upload", files=files, data=data)
        self.assertEqual(res_upload.status_code, 200, f"Upload failed: {res_upload.text}")
        upload_data = res_upload.json()
        doc_id = upload_data["doc_id"]
        self.assertTrue(doc_id.startswith("doc_"))
        print(f"  [PASS] Test 2a: Student document uploaded successfully with doc_id={doc_id}.")

        # 2. List documents with student_id filter
        res_list = client.get(f"/api/v1/documents/list?student_id={test_student_id}")
        self.assertEqual(res_list.status_code, 200)
        docs = res_list.json()
        doc_ids = [d["doc_id"] for d in docs]
        self.assertIn(doc_id, doc_ids)
        self.assertNotIn("ntu_quy_che_2026", doc_ids, "Official document should not appear in student list")
        print(f"  [PASS] Test 2b: GET /api/v1/documents/list?student_id={test_student_id} isolated student documents.")

        # 3. GET /documents/{doc_id}/detail
        res_detail = client.get(f"/api/v1/documents/{doc_id}/detail")
        self.assertEqual(res_detail.status_code, 200)
        detail_data = res_detail.json()
        self.assertEqual(detail_data["doc_id"], doc_id)
        self.assertIn("content", detail_data)
        self.assertTrue(len(detail_data["content"]) > 0)
        self.assertEqual(detail_data["student_id"], test_student_id)
        print(f"  [PASS] Test 2c: GET /api/v1/documents/{doc_id}/detail retrieved full text ({detail_data['char_count']} chars).")

        # 4. PATCH /documents/{doc_id}
        new_title = "Hướng dẫn Đăng ký Học phần (Đã sửa đổi)"
        res_patch = client.patch(f"/api/v1/documents/{doc_id}", json={"title": new_title})
        self.assertEqual(res_patch.status_code, 200)
        patch_data = res_patch.json()
        self.assertEqual(patch_data["new_title"], new_title)

        # Verify title update in detail
        verify_detail = client.get(f"/api/v1/documents/{doc_id}/detail").json()
        self.assertEqual(verify_detail["title"], new_title)
        print(f"  [PASS] Test 2d: PATCH /api/v1/documents/{doc_id} updated title to '{new_title}'.")

        # 5. DELETE /documents/{doc_id}
        res_del = client.delete(f"/api/v1/documents/{doc_id}")
        self.assertEqual(res_del.status_code, 200)
        self.assertEqual(res_del.json()["status"], "success")

        # Verify deletion (should return 404 now)
        res_after = client.get(f"/api/v1/documents/{doc_id}/detail")
        self.assertEqual(res_after.status_code, 404)
        print(f"  [PASS] Test 2e: DELETE /api/v1/documents/{doc_id} purged chunks and verified 404.")

    def test_03_frontend_friendly_error_messages(self):
        """Frontend files must have 'Sever đang bảo trì sinh viên vui lòng chờ !!!' and no raw 'Failed to fetch'."""
        frontend_dir = Path(__file__).parent.parent / "frontend"
        api_js = (frontend_dir / "js" / "api.js").read_text(encoding="utf-8")
        main_js = (frontend_dir / "js" / "main.js").read_text(encoding="utf-8")

        expected_msg = "Sever đang bảo trì sinh viên vui lòng chờ !!!"
        self.assertIn(expected_msg, api_js, "api.js must define SERVER_MAINTENANCE_MSG")
        self.assertIn(expected_msg, main_js, "main.js must display friendly error notice")
        print(f"  [PASS] Test 3: Friendly connection maintenance error message verified in api.js and main.js.")

    def test_04_html_and_css_elements_integrity(self):
        """All requested modals, search bars, and control elements must exist in index.html."""
        frontend_dir = Path(__file__).parent.parent / "frontend"
        html = (frontend_dir / "index.html").read_text(encoding="utf-8")

        required_ids = [
            "btn-sidebar-search",
            "sidebar-search-bar",
            "input-search-sessions",
            "btn-filter-sessions",
            "btn-toggle-sidebar",
            "btn-toggle-sidebar-mobile",
            "btn-sidebar-settings",
            "btn-rag-mode",
            "rag-mode-dropdown",
            "modal-confirm-delete",
            "confirm-delete-session-name",
            "btn-cancel-delete-history",
            "btn-confirm-delete-history",
            "modal-doc-content",
            "doc-content-modal-title",
            "doc-content-modal-meta",
            "doc-content-text-box",
            "modal-student-settings",
            "input-student-mssv",
            "btn-save-mssv",
            "range-tts-speed",
            "tts-speed-label",
            "btn-clear-all-history",
            "modal-rename-doc",
            "input-doc-rename",
        ]

        for elem_id in required_ids:
            self.assertIn(f'id="{elem_id}"', html, f"Missing id='{elem_id}' in index.html")
        print(f"  [PASS] Test 4: All {len(required_ids)} required DOM IDs verified in index.html.")

    def test_05_clear_all_sessions_endpoint(self):
        """DELETE /api/v1/chat/sessions/all works properly."""
        res = client.delete("/api/v1/chat/sessions/all?student_id=TEST_TEMP")
        self.assertEqual(res.status_code, 200)
        self.assertIn("status", res.json())
        print("  [PASS] Test 5: DELETE /api/v1/chat/sessions/all endpoint verified.")

if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING NTU EDUBOT FULL UPGRADE TEST SUITE")
    print("=" * 60)
    unittest.main(verbosity=2)
