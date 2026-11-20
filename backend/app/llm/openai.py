"""OpenAI Chat Completions implementation of the LLM provider interface."""

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


class OpenAIProvider(LLMProvider):
    """OpenAI provider using the public Chat Completions API over httpx."""

    name = "openai"
    endpoint = "https://api.openai.com/v1/chat/completions"

    def __init__(self, api_key: str | None, model: str) -> None:
        if not api_key:
            raise LLMProviderError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
        self.api_key = api_key
        self.model = model

    async def _completion(
        self,
        user_content: str | list[dict[str, Any]],
        *,
        system: str,
        json_mode: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.2,
    ) -> str:
        """Call Chat Completions and return the assistant text."""
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(self.endpoint, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            logger.warning("OpenAI request failed: %s", type(exc).__name__)
            raise LLMProviderError("Could not reach OpenAI. Check the network and retry.") from exc
        if response.status_code >= 400:
            logger.warning("OpenAI returned HTTP %s", response.status_code)
            raise LLMProviderError(f"OpenAI returned HTTP {response.status_code}")
        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMProviderError("OpenAI returned an unexpected response body") from exc
        if not isinstance(content, str) or not content.strip():
            raise LLMProviderError("OpenAI returned an empty response")
        return content.strip()

    async def extract_profile(self, *, text: str, language: str = "en") -> ProfileExtraction:
        """Extract structured profile updates with OpenAI."""
        try:
            raw = await self._completion(
                profile_prompt(text, language),
                system=system_instruction(language),
                json_mode=True,
                max_tokens=1200,
            )
            data = parse_json_object(raw)
            data["confidence"] = {
                key: clamp_confidence(value)
                for key, value in (data.get("confidence") or {}).items()
            }
            return ProfileExtraction.model_validate(data)
        except ValidationError as exc:
            raise LLMProviderError("OpenAI profile response failed validation") from exc

    async def extract_document(
        self,
        *,
        image_bytes: bytes,
        mime_type: str,
        filename: str,
        expected_type: str | None = None,
        language: str = "en",
    ) -> DocumentExtraction:
        """Extract document fields from an image with OpenAI vision."""
        if mime_type == "application/pdf":
            raise LLMProviderError(
                "The OpenAI provider currently supports image uploads only; "
                "use LLM_PROVIDER=mock or anthropic for PDFs."
            )
        media_type = mime_type if mime_type.startswith("image/") else "image/png"
        data_url = f"data:{media_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
        user_content = [
            {"type": "text", "text": f"Filename: {filename}\n{document_prompt(expected_type, language)}"},
            {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
        ]
        try:
            raw = await self._completion(
                user_content,
                system=system_instruction(language),
                json_mode=True,
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
            raise LLMProviderError("OpenAI document response failed validation") from exc

    async def explain(
        self,
        *,
        scheme: Scheme,
        profile: Mapping[str, Any],
        language: str = "en",
    ) -> str:
        """Explain a scheme with grounded JSON context."""
        return await self._completion(
            explain_prompt(scheme, dict(profile), language),
            system=system_instruction(language),
            max_tokens=500,
        )

    async def chat(self, *, question: str, context: str, language: str = "en") -> str:
        """Answer a grounded question with citations."""
        return await self._completion(
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
        raw = await self._completion(
            error_prompt(error_text, field, current_value, language),
            system=system_instruction(language),
            json_mode=True,
            max_tokens=400,
            temperature=0.0,
        )
        try:
            return ErrorInterpretation.model_validate(parse_json_object(raw))
        except ValidationError as exc:
            raise LLMProviderError("OpenAI error interpretation failed validation") from exc
