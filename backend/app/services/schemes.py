"""Load, validate and cache editable scheme definitions from JSON."""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.config import settings
from app.models.scheme import Scheme

logger = logging.getLogger(__name__)


class SchemeRepositoryError(RuntimeError):
    """Raised when scheme files cannot be loaded or validated."""


def validate_scheme_payload(payload: dict[str, Any]) -> Scheme:
    """Validate an admin-edited scheme against the canonical JSON contract."""
    try:
        return Scheme.model_validate(payload)
    except ValidationError as exc:
        raise SchemeRepositoryError(f"Invalid scheme payload: {exc}") from exc


class SchemeRepository:
    """Thread-safe in-memory repository backed by JSON files."""

    def __init__(self, schemes_dir: Path | None = None) -> None:
        self.schemes_dir = schemes_dir or settings.schemes_dir
        self._schemes: dict[str, Scheme] = {}
        self._sources: dict[str, Path] = {}
        self._lock = threading.RLock()
        self._loaded = False

    def reload(self) -> int:
        """Reload every ``*.json`` scheme file and return the scheme count."""
        with self._lock:
            schemes: dict[str, Scheme] = {}
            sources: dict[str, Path] = {}
            errors: list[str] = []
            for path in sorted(self.schemes_dir.glob("*.json")):
                try:
                    with path.open("r", encoding="utf-8") as handle:
                        raw = json.load(handle)
                    scheme = validate_scheme_payload(raw)
                except (OSError, json.JSONDecodeError, SchemeRepositoryError) as exc:
                    errors.append(f"{path.name}: {exc}")
                    logger.error("Failed to load scheme %s: %s", path.name, exc)
                    continue
                if scheme.id in schemes:
                    errors.append(f"{path.name}: duplicate scheme id '{scheme.id}'")
                    continue
                schemes[scheme.id] = scheme
                sources[scheme.id] = path
            if errors:
                raise SchemeRepositoryError("; ".join(errors))
            if not schemes:
                raise SchemeRepositoryError(f"No scheme JSON files found in {self.schemes_dir}")
            self._schemes = schemes
            self._sources = sources
            self._loaded = True
            logger.info("Loaded %d schemes from %s", len(schemes), self.schemes_dir)
            return len(schemes)

    def _ensure_loaded(self) -> None:
        """Lazily load schemes if the repository has not been initialized."""
        if not self._loaded:
            self.reload()

    def all(self) -> list[Scheme]:
        """Return all schemes ordered by annual benefit, then deadline."""
        self._ensure_loaded()
        with self._lock:
            return sorted(
                self._schemes.values(),
                key=lambda scheme: (-scheme.benefit_amount_per_year, scheme.deadline, scheme.id),
            )

    def all_dicts(self) -> list[dict[str, Any]]:
        """Return schemes as JSON-serializable dictionaries."""
        return [scheme.model_dump(mode="json") for scheme in self.all()]

    def get(self, scheme_id: str) -> Scheme | None:
        """Return one scheme by id, or ``None`` when unknown."""
        self._ensure_loaded()
        with self._lock:
            return self._schemes.get(scheme_id)

    def count(self) -> int:
        """Return the number of loaded schemes."""
        self._ensure_loaded()
        with self._lock:
            return len(self._schemes)

    def source_path(self, scheme_id: str) -> Path | None:
        """Return the JSON file backing a scheme, if known."""
        self._ensure_loaded()
        with self._lock:
            return self._sources.get(scheme_id)

    def upsert(self, scheme: Scheme) -> Path:
        """Validate and persist a scheme to JSON, then refresh the cache.

        Existing scheme files are overwritten in place; new schemes are stored
        as ``<id>.json``. This powers the operator admin page.
        """
        with self._lock:
            self._ensure_loaded()
            path = self._sources.get(scheme.id, self.schemes_dir / f"{scheme.id}.json")
            temporary = path.with_suffix(".json.tmp")
            payload = scheme.model_dump(mode="json")
            temporary.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            temporary.replace(path)
            self.reload()
            return path


scheme_repository = SchemeRepository()


def get_scheme_repository() -> SchemeRepository:
    """Return the shared scheme repository (FastAPI dependency friendly)."""
    return scheme_repository
