@echo off
title NTU EduBot - He thong AI Tra cuu Quy che Hoc vu NTU

setlocal enabledelayedexpansion

:: 1. Dinh nghia duong dan goc
set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "VENV_DIR=%ROOT_DIR%.venv"
set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"
set "UVICORN_EXE=%VENV_DIR%\Scripts\uvicorn.exe"

:: Dam bao module app luon duoc tim thay trong sys.path
set "PYTHONPATH=%BACKEND_DIR%;%PYTHONPATH%"

echo =====================================================================
echo              DAI HOC NGUYEN TRAI - HE THONG AI NTU EDUBOT
echo         Tra cuu Quy che Hoc vu ^& Dao tao Tin chi (RAG Pipeline)
echo =====================================================================
echo.

:: 2. Kiem tra va kich hoat moi truong ao (.venv)
if not exist "%PYTHON_EXE%" (
    echo [*] Moi truong ao .venv chua ton tai. Dang khoi tao...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [!] Loi: Khong the tao moi truong ao Python. Vui long kiem tra Python 3.10+.
        pause
        exit /b 1
    )
    echo [OK] Da tao moi truong ao .venv thanh cong.
    echo [*] Dang cai dat cac thu vien can thiet tu requirements.txt...
    call "%VENV_DIR%\Scripts\activate.bat"
    python -m pip install --upgrade pip
    pip install -r "%BACKEND_DIR%\requirements.txt"
) else (
    echo [OK] Tim thay moi truong ao .venv. Dang kich hoat...
    call "%VENV_DIR%\Scripts\activate.bat"
)

:: 3. Chuyen vao thu muc backend lam viec
cd /d "%BACKEND_DIR%"

:: 4. Kiem tra du lieu Quy che trong MongoDB
echo [*] Kiem tra du lieu Quy che Hoc vu trong MongoDB...
"%PYTHON_EXE%" -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017', serverSelectionTimeoutMS=2000); db = client['ntu_edubot_db']; count = db['document_chunks'].count_documents({'metadata.doc_id': 'ntu_quy_che_2026'}); exit(0 if count > 0 else 1)" >nul 2>&1
if errorlevel 1 (
    echo [i] Chua co du lieu Quy che mau trong MongoDB. Tien hanh nap tu dong...
    "%PYTHON_EXE%" seed_ntu_data.py
) else (
    echo [OK] Du lieu Quy che Dai hoc Nguyen Trai da san sang trong MongoDB.
)

:: 5. Lay dia chi IPv4 LAN de ket noi dien thoai
set "LAN_IP="
for /f "delims=" %%i in ('"%PYTHON_EXE%" -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0]); s.close()" 2^>nul') do (
    set "LAN_IP=%%i"
)

echo.
echo =====================================================================
echo  He thong NTU EduBot dang khoi chay tai:
echo    - May tinh cuc bo [Localhost] : http://localhost:8000
if defined LAN_IP (
    echo    - Dien thoai Smartphone [LAN] : http://!LAN_IP!:8000
    echo.
    echo  [QUET TAI LIEU BANG DIEN THOAI]
    echo  Ket noi dien thoai cung mang Wi-Fi va mo: http://!LAN_IP!:8000
    echo  Bam "Camera Dien thoai" de chup va OCR quy che truc tiep!
)
echo.
echo  Tu dong mo trinh duyet sau 3 giay...
echo  Nhan Ctrl + C de dung may chu.
echo =====================================================================
echo.

:: 6. Tu dong mo trinh duyet sau 3 giay
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:8000"

:: 7. Khoi chay Uvicorn Server qua Python module voi app-dir chuan xac
"%PYTHON_EXE%" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir "%BACKEND_DIR%"

pause
