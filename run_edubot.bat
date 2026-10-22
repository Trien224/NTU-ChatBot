@echo off
chcp 65001 >nul
title NTU EduBot - Hệ thống AI Tra cứu Quy chế Học vụ

echo =====================================================================
echo              ĐẠI HỌC NGUYỄN TRÃI - HỆ THỐNG AI NTU EDUBOT
echo         Tra cứu Quy chế Học vụ & Đào tạo Tín chỉ (RAG Pipeline)
echo =====================================================================
echo.

cd /d "%~dp0"

:: 1. Kiểm tra môi trường ảo Python (.venv)
if not exist ".venv\Scripts\activate.bat" (
    echo [*] Môi trường ảo .venv chưa tồn tại. Đang khởi tạo...
    python -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo [!] Lỗi: Không thể tạo môi trường ảo Python. Vui lòng kiểm tra cài đặt Python 3.10+.
        pause
        exit /b %ERRORLEVEL%
    )
    echo [✓] Đã tạo môi trường ảo .venv thành công.
    echo [*] Đang kích hoạt môi trường và cài đặt các thư viện cần thiết...
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r backend\requirements.txt
    if %ERRORLEVEL% neq 0 (
        echo [!] Cảnh báo: Có lỗi xảy ra trong quá trình cài đặt requirements.txt.
    )
) else (
    echo [✓] Tìm thấy môi trường ảo .venv. Đang kích hoạt...
    call .venv\Scripts\activate.bat
)

echo.
cd /d "%~dp0backend"

:: 2. Kiểm tra dữ liệu mẫu trong MongoDB
echo [*] Kiểm tra dữ liệu Quy chế Học vụ trong MongoDB Local...
python -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017', serverSelectionTimeoutMS=2000); db = client['ntu_edubot_db']; count = db['document_chunks'].count_documents({'metadata.doc_id': 'ntu_quy_che_2026'}); exit(0 if count > 0 else 1)" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [i] Chưa có dữ liệu Quy chế mẫu trong MongoDB. Tiến hành nạp tự động...
    python seed_ntu_data.py
) else (
    echo [✓] Dữ liệu Quy chế Đại học Nguyễn Trãi đã sẵn sàng trong MongoDB.
)

:: 3. Lấy địa chỉ IPv4 LAN để kết nối điện thoại
set LAN_IP=
for /f "tokens=*" %%i in ('python -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0]); s.close()" 2^>nul') do set LAN_IP=%%i

echo.
echo =====================================================================
echo  Hệ thống NTU EduBot đang khởi chạy tại:
echo    - Máy tính cục bộ (Localhost) : http://localhost:8000
if defined LAN_IP (
echo    - Điện thoại Smartphone (LAN) : http://%LAN_IP%:8000
)
echo.
if defined LAN_IP (
echo  [📸 QUÉT TÀI LIỆU BẰNG ĐIỆN THOẠI]:
echo  Kết nối điện thoại cùng mạng Wi-Fi và mở: http://%LAN_IP%:8000
echo  Bấm "📱 Camera Điện thoại" để chụp và OCR quy chế trực tiếp!
echo.
)
echo  Tự động mở trình duyệt sau 3 giây...
echo  Nhấn Ctrl + C để dừng máy chủ.
echo =====================================================================
echo.

:: 4. Mở trình duyệt web sau 3 giây
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:8000"

:: 5. Khởi chạy Uvicorn Server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
