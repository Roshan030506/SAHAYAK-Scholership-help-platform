"""Load and validate the editable official scholarship portal directory."""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path

from pydantic import ValidationError

from app.config import settings
from app.models.portal import Portal

logger = logging.getLogger(__name__)


class PortalRepositoryError(RuntimeError):
    """Raised when the portal directory cannot be loaded or validated."""


class PortalRepository:
    """Thread-safe in-memory portal directory backed by one JSON file."""

    def __init__(self, portals_path: Path | None = None) -> None:
        self.portals_path = portals_path or settings.portals_path
        self._portals: list[Portal] = []
        self._lock = threading.RLock()
        self._loaded = False

    def reload(self) -> int:
        """Reload and validate the portal file, returning the portal count."""
        with self._lock:
            try:
                with self.portals_path.open("r", encoding="utf-8") as handle:
                    raw = json.load(handle)
            except OSError as exc:
                raise PortalRepositoryError(
                    f"Could not read portal directory {self.portals_path}: {exc}"
                ) from exc
            except json.JSONDecodeError as exc:
                raise PortalRepositoryError(f"Invalid portal JSON: {exc}") from exc

            if not isinstance(raw, list) or not raw:
                raise PortalRepositoryError("Portal directory must be a non-empty JSON array")

            portals: list[Portal] = []
            seen: set[str] = set()
            for index, item in enumerate(raw):
                try:
                    portal = Portal.model_validate(item)
                except ValidationError as exc:
                    raise PortalRepositoryError(f"Invalid portal at index {index}: {exc}") from exc
                if portal.id in seen:
                    raise PortalRepositoryError(f"Duplicate portal id '{portal.id}'")
                seen.add(portal.id)
                portals.append(portal)

            self._portals = portals
            self._loaded = True
            logger.info("Loaded %d scholarship portals from %s", len(portals), self.portals_path)
            return len(portals)

    def _ensure_loaded(self) -> None:
        """Load the directory lazily when it has not been initialized."""
        if not self._loaded:
            self.reload()

    def all(self) -> list[Portal]:
        """Return every portal in the curated file order."""
        self._ensure_loaded()
        with self._lock:
            return list(self._portals)

    def all_dicts(self) -> list[dict[str, object]]:
        """Return portals as JSON-serializable dictionaries."""
        return [portal.model_dump(mode="json") for portal in self.all()]

    def count(self) -> int:
        """Return the number of loaded portals."""
        self._ensure_loaded()
        with self._lock:
            return len(self._portals)


portal_repository = PortalRepository()


def get_portal_repository() -> PortalRepository:
    """Return the shared portal repository (FastAPI dependency friendly)."""
    return portal_repository
