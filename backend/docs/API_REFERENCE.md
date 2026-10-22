# NTU EduBot - Tài liệu Kỹ thuật Chi tiết API (API Reference)

Tài liệu kỹ thuật đặc tả chi tiết toàn bộ các điểm cuối giao tiếp (API Endpoints) của hệ thống **NTU EduBot** (FastAPI Backend). Tài liệu phục vụ công tác đối soát, thẩm định kiến trúc và chấm điểm đồ án tốt nghiệp.

---

## 📑 Bảng tổng hợp các Endpoint

| STT | Phương thức | Đường dẫn Endpoint | Nhóm chức năng | Mô tả tóm tắt |
|:---:|:---:|:---|:---|:---|
| 1 | `GET` | `/health` | Giám sát hệ thống | Kiểm tra tình trạng kết nối MongoDB và số lượng Gemini API Keys |
| 2 | `GET` | `/` | Giao diện Web | Phục vụ trực tiếp Single-Page Application (`frontend/index.html`) |
| 3 | `POST` | `/api/v1/chat/stream` | AI RAG Chat | Hỏi đáp quy chế dạng Server-Sent Events (SSE) theo thời gian thực |
| 4 | `POST` | `/api/v1/chat/message` | AI RAG Chat | Hỏi đáp quy chế trả lời một lần (Non-streaming) kèm trích dẫn |
| 5 | `GET` | `/api/v1/chat/history/{session_id}` | Quản lý hội thoại | Lấy toàn bộ lịch sử hỏi đáp theo phiên làm việc |
| 6 | `DELETE` | `/api/v1/chat/history/{session_id}` | Quản lý hội thoại | Xóa sạch lịch sử tin nhắn của phiên làm việc |
| 7 | `POST` | `/api/v1/documents/upload` | Quản lý quy chế | Nạp tài liệu quy chế (PDF/Scan/Ảnh/Text) vào kho tri thức vector |
| 8 | `GET` | `/api/v1/documents/list` | Quản lý quy chế | Truy vấn danh mục các văn bản quy chế đã được lập chỉ mục |
| 9 | `DELETE` | `/api/v1/documents/{doc_id}` | Quản lý quy chế | Xóa toàn bộ vector chunks của văn bản quy chế theo `doc_id` |
| 10 | `POST` | `/api/v1/voice/transcribe` | Xử lý giọng nói | Nhận dạng âm thanh giọng nói tiếng Việt (Gemini Multimodal STT) |
| 11 | `GET` | `/api/v1/voice/config` | Xử lý giọng nói | Lấy cấu hình tham số giọng đọc tiếng Việt cho Web Speech API |

---

## 1. Giám sát & Giao diện Hệ thống

### 1.1. Health Check Probe
- **Endpoint**: `GET /health`
- **Mô tả**: Kiểm tra khả năng kết nối tới MongoDB Local/Atlas và thống kê số lượng API Keys sẵn sàng cho cơ chế Round-Robin.
- **Phản hồi thành công (`200 OK`)**:
```json
{
  "status": "healthy",
  "database": "connected",
  "gemini_keys_available": 2,
  "version": "1.0.0"
}
```

### 1.2. Root Web Interface
- **Endpoint**: `GET /`
- **Mô tả**: Trả về trực tiếp tệp `frontend/index.html` với MIME type `text/html; charset=utf-8` nếu ứng dụng giao diện được tích hợp, hoặc JSON trạng thái hệ thống.

---

## 2. Nhóm Endpoint Hỏi đáp AI RAG (Chat & Inquiries)

### 2.1. Hỏi đáp Streaming thời gian thực (Server-Sent Events - SSE)
- **Endpoint**: `POST /api/v1/chat/stream`
- **Headers yêu cầu**:
  - `Content-Type: application/json`
  - `Accept: text/event-stream`
- **Request Body Schema (`ChatRequest`)**:
```json
{
  "session_id": "ntu_session_demo_01",
  "question": "Điều kiện xét học bổng khuyến khích học tập là gì?",
  "top_k": 5
}
```

- **Cấu trúc luồng sự kiện SSE (Server-Sent Events Protocol)**:
  1. **Sự kiện Trích dẫn Nguồn (`event: sources`)**: Được gửi đầu tiên ngay khi hoàn tất tìm kiếm vector và tái xếp hạng Cohere Rerank:
     ```http
     event: sources
     data: [
       {
         "chunk_id": "ntu_quy_che_2026_chunk_0014",
         "title": "Quy chế Đào tạo trình độ Đại học - Đại học Nguyễn Trãi",
         "article": "Điều 9",
         "clause": "Khoản 1",
         "filename": "quy_che_dao_tao_ntu.txt",
         "page_number": null,
         "score": 0.8842
       }
     ]
     ```
  2. **Sự kiện Token Nội dung (`event: message`)**: Stream từng phần từ vựng sinh ra từ mô hình `gemini-3.8-flash`:
     ```http
     event: message
     data: {"token": "Căn "}

     event: message
     data: {"token": "cứ "}

     event: message
     data: {"token": "theo "}

     event: message
     data: {"token": "Điều 9..."}
     ```
  3. **Sự kiện Kết thúc (`event: done`)**: Báo hiệu stream đã hoàn tất và tin nhắn đã được lưu vào MongoDB:
     ```http
     event: done
     data: {"status": "completed", "session_id": "ntu_session_demo_01"}
     ```

- **Headers phản hồi chống bộ đệm Proxy**:
  ```http
  Content-Type: text/event-stream; charset=utf-8
  Cache-Control: no-cache
  Connection: keep-alive
  X-Accel-Buffering: no
  ```

---

### 2.2. Hỏi đáp một lần (Non-streaming)
- **Endpoint**: `POST /api/v1/chat/message`
- **Request Body (`ChatRequest`)**:
```json
{
  "session_id": "ntu_session_demo_01",
  "question": "Sinh viên bị cảnh báo học vụ khi nào?",
  "top_k": 5
}
```
- **Response Body (`ChatResponse`) (`200 OK`)**:
```json
{
  "session_id": "ntu_session_demo_01",
  "answer": "Căn cứ theo Điều 7 Quy chế Đào tạo trình độ Đại học theo hệ thống tín chỉ của Trường Đại học Nguyễn Trãi, sinh viên bị cảnh báo học vụ nếu rơi vào một trong các trường hợp sau:...",
  "sources": [
    {
      "chunk_id": "ntu_quy_che_2026_chunk_0012",
      "title": "Quy chế Đào tạo trình độ Đại học - Đại học Nguyễn Trãi",
      "article": "Điều 7",
      "clause": "CHƯƠNG III: CẢNH BÁO HỌC VỤ VÀ BUỘC THÔI HỌC",
      "filename": "quy_che_dao_tao_ntu.txt",
      "page_number": null,
      "score": 0.9124
    }
  ],
  "timestamp": "2026-10-22T23:15:00.000000Z"
}
```

---

### 2.3. Lấy lịch sử hội thoại
- **Endpoint**: `GET /api/v1/chat/history/{session_id}`
- **Response Body (`ChatHistoryResponse`) (`200 OK`)**:
```json
{
  "session_id": "ntu_session_demo_01",
  "total_messages": 2,
  "messages": [
    {
      "role": "user",
      "content": "Điều kiện xét học bổng khuyến khích học tập là gì?",
      "timestamp": "2026-10-22T23:14:00.000000Z",
      "sources": []
    },
    {
      "role": "assistant",
      "content": "Căn cứ theo Điều 9 và Điều 10 Quy chế...",
      "timestamp": "2026-10-22T23:14:03.000000Z",
      "sources": [ ... ]
    }
  ]
}
```

---

### 2.4. Xóa lịch sử phiên chat
- **Endpoint**: `DELETE /api/v1/chat/history/{session_id}`
- **Response Body (`200 OK`)**:
```json
{
  "status": "success",
  "message": "Đã xóa toàn bộ lịch sử của phiên ntu_session_demo_01.",
  "session_id": "ntu_session_demo_01"
}
```

---

## 3. Nhóm Endpoint Quản lý Kho Tri thức & Tài liệu (Documents)

### 3.1. Tải lên và nạp Quy chế (Upload & Ingestion)
- **Endpoint**: `POST /api/v1/documents/upload`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `file`: `UploadFile` (Hỗ trợ `.pdf`, `.png`, `.jpg`, `.jpeg`, `.txt`)
  - `title`: `Optional[str]` (Tiêu đề tài liệu)
- **Quy trình xử lý tự động**:
  1. Lưu file an toàn tại `backend/data_temp/` kèm tiền tố UUID chống trùng lặp.
  2. Bóc tách chữ qua `pypdf`; tự động kích hoạt **Gemini Vision OCR** nếu là PDF scan dạng ảnh.
  3. Bóc tách văn bản thành khối pháp lý chuẩn qua `RegExTextSplitter` (Chương, Điều, Khoản) kèm **Metadata Enrichment**.
  4. Tạo vector 768 chiều qua `text-embedding-004` (kèm fallback pseudo-vector).
  5. Nạp danh sách chunks vào MongoDB collection `document_chunks`.
  6. Xóa file tạm trong khối `finally`.
- **Response Body (`UploadResponse`) (`200 OK`)**:
```json
{
  "success": true,
  "message": "Tài liệu quy chế đã được tiếp nhận, trích xuất và lập chỉ mục vector thành công.",
  "doc_id": "doc_a8f9b2c3d4",
  "filename": "quy_che_dao_tao_2024.pdf",
  "total_chunks": 22,
  "extra_info": {
    "title": "Quy chế Đào tạo 2024",
    "char_count": 10572
  }
}
```

---

### 3.2. Liệt kê danh mục Quy chế đã nạp
- **Endpoint**: `GET /api/v1/documents/list`
- **Mô tả**: Sử dụng Aggregation Pipeline trên MongoDB gom nhóm theo `metadata.doc_id`.
- **Response Body (`200 OK`)**:
```json
[
  {
    "doc_id": "ntu_quy_che_2026",
    "filename": "quy_che_dao_tao_ntu.txt",
    "title": "Quy chế Đào tạo trình độ Đại học - Đại học Nguyễn Trãi",
    "created_at": "2026-10-22T16:05:34.123000Z",
    "total_chunks": 22
  }
]
```

---

### 3.3. Xóa văn bản quy chế khỏi cơ sở tri thức
- **Endpoint**: `DELETE /api/v1/documents/{doc_id}`
- **Response Body (`200 OK`)**:
```json
{
  "status": "success",
  "message": "Đã xóa thành công tài liệu 'doc_a8f9b2c3d4' (22 đoạn trích).",
  "doc_id": "doc_a8f9b2c3d4",
  "deleted_chunks": 22
}
```

---

## 4. Nhóm Endpoint Xử lý Giọng nói (Voice STT / TTS)

### 4.1. Nhận dạng Giọng nói thành Văn bản (Speech-to-Text)
- **Endpoint**: `POST /api/v1/voice/transcribe`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `audio`: `UploadFile` (Tệp âm thanh thu âm từ trình duyệt: `.webm`, `.wav`, `.mp3`, `.ogg`)
- **Công nghệ**: Khả năng Multimodal Audio trực tiếp của **Google Gemini 2.5/3.8 Flash**.
- **Response Body (`200 OK`)**:
```json
{
  "text": "Điều kiện để được xét học bổng khuyến khích học tập là gì?",
  "status": "success"
}
```

---

### 4.2. Cấu hình Phát âm thanh (Text-to-Speech Config)
- **Endpoint**: `GET /api/v1/voice/config`
- **Mô tả**: Trả về thông số giọng đọc chuẩn tiếng Việt (`vi-VN`) cho Web Speech API phía Client.
- **Response Body (`200 OK`)**:
```json
{
  "text": "",
  "lang": "vi-VN",
  "rate": 1.0,
  "pitch": 1.0,
  "engine": "web_speech_api"
}
```

---

## 5. Bảng mã trạng thái HTTP (Status Codes)

| Mã HTTP | Tên chuẩn | Trường hợp trả về |
|:---:|:---|:---|
| `200` | OK | Xử lý yêu cầu thành công |
| `400` | Bad Request | Dữ liệu đầu vào không hợp lệ (thiếu filename, file âm thanh rỗng...) |
| `404` | Not Found | Không tìm thấy tài liệu quy chế hoặc phiên làm việc tương ứng |
| `422` | Unprocessable Entity | File tải lên không bóc tách được nội dung văn bản hợp lệ |
| `500` | Internal Server Error | Lỗi cơ sở dữ liệu hoặc ngoại lệ chưa được xử lý |

---

*Tài liệu được cập nhật ngày 22/10/2026 bởi Đội ngũ Phát triển Dự án NTU EduBot.*
