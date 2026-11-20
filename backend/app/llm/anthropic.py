"""Anthropic Messages API implementation of the LLM provider interface."""

from __future__ import annotations

import base64
import logging
from typing import Any, Mapping

import httpx
from pydantic import ValidationError

from app.llm.base import (
    DocumentExtraction,
    ErrorInterpretation,
    LLMProvider,
    LLMProviderError,
    ProfileExtraction,
)
from app.llm.json_utils import clamp_confidence, parse_json_object
from app.llm.prompts import (
    chat_prompt,
    document_prompt,
    error_prompt,
    explain_prompt,
    profile_prompt,
    system_instruction,
)
from app.models.scheme import Scheme

logger = logging.getLogger(__name__)


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider using the public Messages API."""

    name = "anthropic"
    endpoint = "https://api.anthropic.com/v1/messages"

    def __init__(self, api_key: str | None, model: str) -> None:
        if not api_key:
            raise LLMProviderError("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic")
        self.api_key = api_key
        self.model = model

    async def _message(
        self,
        content: str | list[dict[str, Any]],
        *,
        system: str,
        max_tokens: int = 1024,
        temperature: float = 0.2,
    ) -> str:
        """Call the Messages API and return concatenated text blocks."""
        payload: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system,
            "messages": [{"role": "user", "content": content}],
        }
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(self.endpoint, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            logger.warning("Anthropic request failed: %s", type(exc).__name__)
            raise LLMProviderError("Could not reach Anthropic. Check the network and retry.") from exc
        if response.status_code >= 400:
            logger.warning("Anthropic returned HTTP %s", response.status_code)
            raise LLMProviderError(f"Anthropic returned HTTP {response.status_code}")
        try:
            data = response.json()
            text = "".join(
                block.get("text", "")
                for block in data.get("content", [])
                if block.get("type") == "text"
            ).strip()
        except (ValueError, AttributeError) as exc:
            raise LLMProviderError("Anthropic returned an unexpected response body") from exc
        if not text:
            raise LLMProviderError("Anthropic returned an empty response")
        return text

    async def extract_profile(self, *, text: str, language: str = "en") -> ProfileExtraction:
        """Extract structured profile updates with Claude."""
        try:
            raw = await self._message(
                profile_prompt(text, language),
                system=system_instruction(language),
                max_tokens=1200,
            )
            data = parse_json_object(raw)
            data["confidence"] = {
                key: clamp_confidence(value)
                for key, value in (data.get("confidence") or {}).items()
            }
            return ProfileExtraction.model_validate(data)
        except ValidationError as exc:
            raise LLMProviderError("Anthropic profile response failed validation") from exc

    async def extract_document(
        self,
        *,
        image_bytes: bytes,
        mime_type: str,
        filename: str,
        expected_type: str | None = None,
        language: str = "en",
    ) -> DocumentExtraction:
        """Extract document fields from an image or PDF with Claude vision."""
        media_type = mime_type if mime_type in {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"} else "image/png"
        source = {
            "type": "base64",
            "media_type": media_type,
            "data": base64.b64encode(image_bytes).decode("ascii"),
        }
        block_type = "document" if media_type == "application/pdf" else "image"
        content = [
            {"type": block_type, "source": source},
            {"type": "text", "text": f"Filename: {filename}\n{document_prompt(expected_type, language)}"},
        ]
        try:
            raw = await self._message(
                content,
                system=system_instruction(language),
                max_tokens=1200,
                temperature=0.0,
            )
            data = parse_json_object(raw)
            data["confidence"] = {
                key: clamp_confidence(value)
                for key, value in (data.get("confidence") or {}).items()
            }
            if data.get("raw_text"):
                data["raw_text"] = str(data["raw_text"])[:5000]
            data["warnings"] = [str(item)[:300] for item in (data.get("warnings") or [])][:5]
            return DocumentExtraction.model_validate(data)
        except ValidationError as exc:
            raise LLMProviderError("Anthropic document response failed validation") from exc

    async def explain(
        self,
        *,
        scheme: Scheme,
        profile: Mapping[str, Any],
        language: str = "en",
    ) -> str:
        """Explain a scheme with grounded JSON context."""
        return await self._message(
            explain_prompt(scheme, dict(profile), language),
            system=system_instruction(language),
            max_tokens=500,
        )

    async def chat(self, *, question: str, context: str, language: str = "en") -> str:
        """Answer a grounded question with citations."""
        return await self._message(
            chat_prompt(question, context, language),
            system=system_instruction(language),
            max_tokens=600,
            temperature=0.1,
        )

    async def interpret_error(
        self,
        *,
        error_text: str,
        field: str | None,
        current_value: Any,
        language: str = "en",
    ) -> ErrorInterpretation:
        """Interpret a portal error and propose an action."""
        raw = await self._message(
            error_prompt(error_text, field, current_value, language),
            system=system_instruction(language),
            max_tokens=400,
            temperature=0.0,
        )
        try:
            return ErrorInterpretation.model_validate(parse_json_object(raw))
        except ValidationError as exc:
            raise LLMProviderError("Anthropic error interpretation failed validation") from exc
