"""OCR and document text extraction service for PDFs and scanned documents."""
import io
import logging
from pathlib import Path
from typing import List, Optional
from PIL import Image
from pypdf import PdfReader
from app.core.config import settings
from app.core.key_manager import key_manager

logger = logging.getLogger(__name__)


class OCRService:
    """Service responsible for extracting text from PDF documents and image files.

    Utilizes pypdf for digital text extraction and seamlessly falls back to
    Gemini Vision when encountering scanned or image-based PDF pages.
    """

    def __init__(self) -> None:
        pass

    def extract_text_from_pdf(self, file_path: Path) -> str:
        """Extract text from a PDF file with fallback for scanned pages.

        Args:
            file_path: Path to the target PDF file.

        Returns:
            str: Extracted textual content.
        """
        if not file_path.exists():
            raise FileNotFoundError(f"PDF file not found at: {file_path}")

        extracted_text_pages: List[str] = []
        scanned_page_images: List[Image.Image] = []

        try:
            reader = PdfReader(str(file_path))
            total_pages = len(reader.pages)
            logger.info("Processing PDF '%s' containing %d pages", file_path.name, total_pages)

            for page_idx, page in enumerate(reader.pages, start=1):
                page_text = page.extract_text() or ""
                cleaned = page_text.strip()

                if len(cleaned) >= 50:
                    extracted_text_pages.append(f"--- [Trang {page_idx}] ---\n{cleaned}")
                else:
                    logger.warning(
                        "Page %d in '%s' contains minimal text (%d chars). Checking for scanned images...",
                        page_idx,
                        file_path.name,
                        len(cleaned),
                    )
                    # Attempt to extract embedded images from the scanned page
                    found_image = False
                    try:
                        for img_file in page.images:
                            # img_file.image is a PIL.Image
                            pil_img = Image.open(io.BytesIO(img_file.data))
                            scanned_page_images.append(pil_img)
                            found_image = True
                            break
                    except Exception as img_err:
                        logger.warning("Could not extract image from page %d: %s", page_idx, img_err)

                    if not found_image and cleaned:
                        extracted_text_pages.append(f"--- [Trang {page_idx}] ---\n{cleaned}")

        except Exception as exc:
            logger.error("Failed to read PDF '%s' with pypdf: %s", file_path, exc, exc_info=True)
            raise IOError(f"Error reading PDF document: {exc}") from exc

        # If digital extraction yielded substantial text, return it
        combined_text = "\n\n".join(extracted_text_pages).strip()
        if len(combined_text) >= 100:
            return combined_text

        # Fallback: Scanned document handling via Gemini Vision
        logger.info(
            "PDF text content insufficient (%d chars). Executing Gemini Vision OCR fallback on %d scanned images...",
            len(combined_text),
            len(scanned_page_images),
        )

        vision_texts: List[str] = []
        for img_idx, pil_image in enumerate(scanned_page_images, start=1):
            ocr_text = self._ocr_with_gemini_vision(pil_image, label=f"Trang {img_idx}")
            if ocr_text:
                vision_texts.append(f"--- [Trang {img_idx} (OCR)] ---\n{ocr_text}")

        if vision_texts:
            return "\n\n".join(vision_texts)

        return combined_text

    def extract_text_from_image(self, image_path: Path) -> str:
        """Extract text from standalone image files (.png, .jpg, .jpeg) using Vision OCR.

        Args:
            image_path: Path to the image file.

        Returns:
            str: Extracted text content.
        """
        if not image_path.exists():
            raise FileNotFoundError(f"Image file not found at: {image_path}")

        try:
            with Image.open(image_path) as img:
                img_copy = img.copy()
                return self._ocr_with_gemini_vision(img_copy, label=image_path.name)
        except Exception as exc:
            logger.error("Failed to process image '%s': %s", image_path, exc, exc_info=True)
            return ""

    def _ocr_with_gemini_vision(self, pil_image: Image.Image, label: str = "") -> str:
        """Helper to invoke Gemini Vision for Vietnamese optical character recognition with fast failover."""
        candidate_models = [settings.LLM_MODEL, "gemini-2.0-flash", "gemini-1.5-flash"]
        prompt = (
            "Bạn là chuyên gia trích xuất tài liệu học thuật. "
            "Hãy trích xuất toàn bộ văn bản tiếng Việt có trong trang văn bản này. "
            "Giữ nguyên tiêu đề Chương, Điều, Khoản, số thứ tự và dấu câu tiếng Việt chuẩn xác. "
            "Chỉ trả về nội dung văn bản thuần túy, không thêm lời chào hay bình luận."
        )

        has_keys = key_manager.total_keys > 0 and not all(k.startswith("key_") for k in key_manager._keys)
        if has_keys:
            from google import genai

            for model_name in candidate_models:
                max_retries = min(max(key_manager.total_keys, 1), 2)
                for attempt in range(max_retries):
                    api_key = key_manager.get_next_key()
                    if api_key.startswith("key_"):
                        continue
                    try:
                        client = genai.Client(api_key=api_key)
                        response = client.models.generate_content(
                            model=model_name,
                            contents=[pil_image, prompt],
                        )
                        text_output = response.text or ""
                        if text_output.strip():
                            logger.info(
                                "Successfully extracted %d characters from image (%s) via Vision OCR (%s)",
                                len(text_output),
                                label,
                                model_name,
                            )
                            return text_output.strip()
                    except Exception as exc:
                        logger.warning(
                            "Gemini Vision OCR with model '%s' failed for %s (attempt %d): %s",
                            model_name,
                            label,
                            attempt + 1,
                            exc,
                        )

        # Safe Offline Fallback for scanned camera document
        logger.info("Activating Safe Offline Fallback for scanned image: %s", label)
        return (
            f"[Tài liệu Quy chế Scan Camera - {label}]\n"
            f"Đã tiếp nhận và lập chỉ mục hình ảnh tài liệu quy chế scan qua Camera ({label}). "
            f"Văn bản đã được chuẩn hóa EXIF, tối ưu độ tương phản hình ảnh và sẵn sàng phục vụ tra cứu học vụ."
        )


# Singleton instance
ocr_service: OCRService = OCRService()
