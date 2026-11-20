"""Translation helpers for reason strings, field labels and UI copy."""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

from app.config import settings
from app.models.scheme import LocalizedText

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = ("en", "hi", "mr")


def normalize_language(language: str | None) -> str:
    """Map language variants such as ``en-IN`` to a supported code."""
    normalized = (language or "en").strip().lower().replace("_", "-").split("-")[0]
    return normalized if normalized in SUPPORTED_LANGUAGES else "en"


@lru_cache(maxsize=8)
def load_locale(language: str) -> dict[str, Any]:
    """Load and cache one locale JSON dictionary."""
    language = normalize_language(language)
    path = settings.locales_dir / f"{language}.json"
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        logger.error("Locale file missing: %s", path)
        return {}
    except json.JSONDecodeError:
        logger.exception("Locale file is invalid JSON: %s", path)
        return {}


def clear_locale_cache() -> None:
    """Clear locale caches (used by tests and admin reloads)."""
    load_locale.cache_clear()


def _lookup(data: dict[str, Any], dotted_key: str) -> Any:
    """Resolve a dotted key inside a nested dictionary."""
    current: Any = data
    for part in dotted_key.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def t(key: str, language: str | None = None, **params: Any) -> str:
    """Translate a dotted key and safely interpolate parameters.

    Falls back to English, then to the key itself. Never raises for missing
    translations so that a partial locale cannot break eligibility results.
    """
    language = normalize_language(language)
    value = _lookup(load_locale(language), key)
    if value is None and language != "en":
        value = _lookup(load_locale("en"), key)
    if not isinstance(value, str):
        return key
    try:
        return value.format(**params)
    except (KeyError, ValueError):
        logger.warning("Locale interpolation failed for key %s", key)
        return value


def localized(text: LocalizedText | dict[str, str] | None, language: str | None = None) -> str:
    """Pick a localized string with a safe English fallback."""
    if text is None:
        return ""
    language = normalize_language(language)
    if isinstance(text, LocalizedText):
        data = text.model_dump()
    elif isinstance(text, dict):
        data = text
    else:
        return str(text)
    return str(data.get(language) or data.get("en") or next(iter(data.values()), ""))


def field_label(field: str, language: str | None = None) -> str:
    """Return a human-readable localized profile field label."""
    translated = t(f"profile.fields.{field}", language)
    return translated if translated != f"profile.fields.{field}" else field.replace("_", " ")


def document_label(document_type: str, language: str | None = None) -> str:
    """Return a localized document name, falling back to a title-cased id."""
    key = f"documents.{document_type}"
    translated = t(key, language)
    return translated if translated != key else document_type.replace("_", " ").title()


def reason_text(outcome: str, label: str, language: str | None = None) -> str:
    """Wrap a rule label with a localized pass/fail/unknown prefix."""
    return t(f"reasons.{outcome}", language, label=label)


def status_reason(status: str, language: str | None = None) -> str:
    """Return the localized one-line status explanation."""
    return t(f"reasons.status.{status}", language)


def status_summary(
    status: str,
    *,
    total: int,
    passed: int,
    failed: int,
    unknown: int,
    language: str | None = None,
) -> str:
    """Return the localized rule-count summary for a result."""
    return t(
        f"reasons.summary.{status}",
        language,
        total=total,
        passed=passed,
        failed=failed,
        unknown=unknown,
    )


def ui_text(key: str, language: str | None = None, **params: Any) -> str:
    """Translate a UI copy key (kept public for future routers)."""
    return t(f"ui.{key}", language, **params)
