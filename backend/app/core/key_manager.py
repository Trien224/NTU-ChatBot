import itertools
import threading
from typing import Iterator, List, Optional
from app.core.config import settings


class GeminiKeyManager:
    """Thread-safe Round-Robin Manager for rotating Gemini API keys."""

    def __init__(self, keys: Optional[List[str]] = None) -> None:
        """Initialize the key manager with a list of keys or defaults from settings.

        Args:
            keys: Optional list of keys. If None, reads from settings.gemini_keys_list.
        """
        self._lock: threading.Lock = threading.Lock()
        self._keys: List[str] = keys if keys is not None else settings.gemini_keys_list
        self._cycler: Optional[Iterator[str]] = (
            itertools.cycle(self._keys) if self._keys else None
        )

    def reload_keys(self, new_keys: List[str]) -> None:
        """Reload the key list and reset the iterator in a thread-safe manner.

        Args:
            new_keys: New list of API keys to use.
        """
        with self._lock:
            self._keys = [k.strip() for k in new_keys if k and k.strip()]
            self._cycler = itertools.cycle(self._keys) if self._keys else None

    def get_next_key(self) -> str:
        """Retrieve the next API key in round-robin sequence.

        Returns:
            str: An active Gemini API key.

        Raises:
            ValueError: If no valid Gemini API keys are configured.
        """
        with self._lock:
            if not self._cycler or not self._keys:
                # Try reloading from settings once more in case env was populated dynamically
                current_keys = settings.gemini_keys_list
                if current_keys:
                    self._keys = current_keys
                    self._cycler = itertools.cycle(self._keys)
                else:
                    raise ValueError(
                        "No Gemini API keys configured. Please specify GEMINI_API_KEYS in your environment or .env file."
                    )
            return next(self._cycler)

    @property
    def total_keys(self) -> int:
        """Return the count of configured keys."""
        return len(self._keys)


# Singleton key manager instance
key_manager: GeminiKeyManager = GeminiKeyManager()
