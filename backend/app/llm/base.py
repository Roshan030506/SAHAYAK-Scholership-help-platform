"""Provider-agnostic LLM interface used by Sahayak."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Literal, Mapping

from pydantic import BaseModel, Field

from app.models.scheme import Scheme


class LLMProviderError(RuntimeError):
    """Raised when an LLM provider is unavailable or returns unusable output."""


class ProfileExtraction(BaseModel):
    """Structured profile updates proposed by an LLM."""

    updates: dict[str, Any] = Field(default_factory=dict)
    confidence: dict[str, float] = Field(default_factory=dict)
    summary: str = ""
    follow_up_questions: list[str] = Field(default_factory=list)


class DocumentExtraction(BaseModel):
    """Fields and per-field confidence extracted from a document."""

    document_type: str | None = None
    fields: dict[str, Any] = Field(default_factory=dict)
    confidence: dict[str, float] = Field(default_factory=dict)
    raw_text: str | None = None
    warnings: list[str] = Field(default_factory=list)


class ErrorInterpretation(BaseModel):
    """Agent guidance after a portal validation or transient failure."""

    action: Literal["correct", "retry", "needs_user_input"]
    field: str | None = None
    corrected_value: Any = None
    explanation: str


class LLMProvider(ABC):
    """Interface implemented by mock, Anthropic and OpenAI providers."""

    name: str = "base"

    @abstractmethod
    async def extract_profile(self, *, text: str, language: str = "en") -> ProfileExtraction:
        """Extract structured profile fields from free-form text."""

    @abstractmethod
    async def extract_document(
        self,
        *,
        image_bytes: bytes,
        mime_type: str,
        filename: str,
        expected_type: str | None = None,
        language: str = "en",
    ) -> DocumentExtraction:
        """Extract typed fields and confidence scores from a document image."""

    @abstractmethod
    async def explain(
        self,
        *,
        scheme: Scheme,
        profile: Mapping[str, Any],
        language: str = "en",
    ) -> str:
        """Explain a scheme's conditions in plain language."""

    @abstractmethod
    async def chat(
        self,
        *,
        question: str,
        context: str,
        language: str = "en",
    ) -> str:
        """Answer a question using only the supplied grounded context."""

    @abstractmethod
    async def interpret_error(
        self,
        *,
        error_text: str,
        field: str | None,
        current_value: Any,
        language: str = "en",
    ) -> ErrorInterpretation:
        """Interpret a portal validation error and propose the next action."""
