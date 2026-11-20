"""Small helpers for parsing JSON produced by LLM providers."""

from __future__ import annotations

import json
import re
from typing import Any

from app.llm.base import LLMProviderError

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def parse_json_object(text: str) -> dict[str, Any]:
    """Extract and parse the first JSON object in an LLM response."""
    stripped = text.strip()
    fence = _FENCE_RE.search(stripped)
    if fence:
        stripped = fence.group(1).strip()
    try:
        value = json.loads(stripped)
    except json.JSONDecodeError:
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end <= start:
            raise LLMProviderError("Provider returned no JSON object") from None
        try:
            value = json.loads(stripped[start : end + 1])
        except json.JSONDecodeError as exc:
            raise LLMProviderError("Provider returned malformed JSON") from exc
    if not isinstance(value, dict):
        raise LLMProviderError("Provider JSON response was not an object")
    return value


def clamp_confidence(value: Any) -> float:
    """Convert arbitrary confidence values into the 0..1 range."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return round(min(max(number, 0.0), 1.0), 3)
