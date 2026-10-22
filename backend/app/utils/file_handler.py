"""File handling utility for saving, validating, and cleaning up uploaded files."""
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Set, Union
from fastapi import UploadFile

logger = logging.getLogger(__name__)

# Base temporary data directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
TEMP_DATA_DIR = BASE_DIR / "data_temp"

ALLOWED_EXTENSIONS: Set[str] = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt"}


def ensure_temp_dir() -> Path:
    """Ensure the temporary data storage directory exists."""
    TEMP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    return TEMP_DATA_DIR


def sanitize_filename(filename: str) -> str:
    """Sanitize the uploaded filename to prevent directory traversal attacks.

    Args:
        filename: Raw incoming filename.

    Returns:
        str: Safe ASCII / alphanumeric filename.
    """
    clean_name = os.path.basename(filename)
    # Remove potentially dangerous characters, keep alphanumerics, dots, underscores, dashes
    clean_name = re.sub(r"[^\w\s\.-]", "_", clean_name).strip()
    return clean_name or "uploaded_document"


def is_allowed_file(filename: str) -> bool:
    """Check if the uploaded file has a supported format extension."""
    suffix = Path(filename).suffix.lower()
    return suffix in ALLOWED_EXTENSIONS


async def save_temp_file(file: UploadFile) -> Path:
    """Save an uploaded file asynchronously to the temporary directory.

    Args:
        file: FastAPI UploadFile instance.

    Returns:
        Path: Absolute path to the securely saved temporary file.

    Raises:
        ValueError: If file is invalid or format is disallowed.
        IOError: If saving the file to disk fails.
    """
    if not file.filename:
        raise ValueError("Uploaded file has no filename.")

    if not is_allowed_file(file.filename):
        raise ValueError(
            f"File format '{Path(file.filename).suffix}' is not supported. "
            f"Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    target_dir = ensure_temp_dir()
    clean_name = sanitize_filename(file.filename)
    unique_prefix = uuid.uuid4().hex[:8]
    safe_filename = f"{unique_prefix}_{clean_name}"
    file_path = target_dir / safe_filename

    try:
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        logger.info("Saved temporary file: %s (%d bytes)", file_path, len(content))
        return file_path
    except Exception as exc:
        logger.error("Failed to save temporary file '%s': %s", file.filename, exc, exc_info=True)
        # Cleanup in case partial file was created
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        raise IOError(f"Could not persist uploaded file: {exc}") from exc
    finally:
        # Reset file cursor for any subsequent reading if needed
        await file.seek(0)


def delete_file(path: Union[str, Path]) -> bool:
    """Safely delete a temporary file from disk.

    Args:
        path: Path to the target file.

    Returns:
        bool: True if deleted successfully, False if file did not exist or error occurred.
    """
    target = Path(path)
    try:
        if target.exists() and target.is_file():
            target.unlink()
            logger.info("Successfully deleted temporary file: %s", target)
            return True
        logger.warning("File not found for deletion: %s", target)
        return False
    except Exception as exc:
        logger.error("Error occurred while deleting file '%s': %s", target, exc, exc_info=True)
        return False
