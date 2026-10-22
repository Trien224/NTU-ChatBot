"""Main entrypoint for the NTU EduBot FastAPI backend application."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator, Dict
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.api.router import api_router
from app.core.config import settings
from app.core.key_manager import key_manager
from app.core.security import setup_cors
from app.db.mongodb import close_mongo_connection, connect_to_mongo, mongo_manager

# Configure structured logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d - %(message)s",
)
logger = logging.getLogger("ntu_edubot")

# Frontend assets paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown lifecycle events."""
    logger.info("Initializing NTU EduBot API backend services...")
    try:
        await connect_to_mongo()
    except Exception as exc:
        logger.warning(
            "MongoDB Atlas connection could not be established at startup: %s. "
            "Please verify MONGO_URI in your .env configuration.",
            exc,
        )

    yield

    logger.info("Gracefully shutting down NTU EduBot API backend services...")
    await close_mongo_connection()


app = FastAPI(
    title=settings.APP_NAME,
    description="Hệ thống AI Tra cứu Quy chế Học vụ Đại học Nguyễn Trãi ứng dụng RAG (Retrieval-Augmented Generation)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure Cross-Origin Resource Sharing (CORS)
setup_cors(app)

# Mount RESTful and SSE API routers (/api/v1/...)
app.include_router(api_router)

# Mount static asset directories for integrated web frontend
if FRONTEND_DIR.exists():
    assets_dir = FRONTEND_DIR / "assets"
    css_dir = FRONTEND_DIR / "css"
    js_dir = FRONTEND_DIR / "js"

    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
    if css_dir.exists():
        app.mount("/css", StaticFiles(directory=str(css_dir)), name="css")
    if js_dir.exists():
        app.mount("/js", StaticFiles(directory=str(js_dir)), name="js")


@app.get("/", tags=["Interface"], summary="Giao diện Web hoặc Trạng thái API")
async def root() -> Any:
    """Serve the Web UI single-page application or API status payload."""
    index_html = FRONTEND_DIR / "index.html"
    if index_html.exists():
        return FileResponse(index_html)

    return {
        "app_name": settings.APP_NAME,
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs",
        "api_v1": "/api/v1",
    }


@app.get(
    "/health",
    tags=["Health"],
    summary="Kiểm tra tình trạng hệ thống",
    description="Kiểm tra kết nối tới cơ sở dữ liệu MongoDB Atlas và số lượng Gemini API Keys sẵn sàng.",
)
async def health_check() -> Dict[str, Any]:
    """Health check endpoint probing MongoDB connection and available AI keys."""
    mongo_status = "connected"
    try:
        if mongo_manager.client:
            await mongo_manager.client.admin.command("ping")
        else:
            mongo_status = "disconnected"
    except Exception as err:
        logger.warning("MongoDB health check ping failed: %s", err)
        mongo_status = "unreachable"

    keys_count = key_manager.total_keys

    return {
        "status": "healthy" if mongo_status == "connected" else "degraded",
        "database": mongo_status,
        "gemini_keys_available": keys_count,
        "version": "1.0.0",
    }
