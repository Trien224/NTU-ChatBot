"""Core application components: configuration, security, and key management."""
from app.core.config import settings
from app.core.key_manager import key_manager
from app.core.security import setup_cors

__all__ = ["settings", "key_manager", "setup_cors"]
