"""Pydantic model for the official scholarship portal directory."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.scheme import LocalizedText

PortalGroup = Literal["central", "state", "csr", "discovery"]


class Portal(BaseModel):
    """One official or CSR scholarship portal linked from the landing page."""

    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,63}$")
    name: LocalizedText
    short_name: LocalizedText
    authority: LocalizedText
    description: LocalizedText
    url: str = Field(min_length=8)
    group: PortalGroup
    tags: list[str] = Field(default_factory=list)

    @field_validator("url")
    @classmethod
    def _validate_url(cls, value: str) -> str:
        """Only allow absolute HTTP(S) links in the external directory."""
        value = value.strip()
        if not (value.startswith("https://") or value.startswith("http://")):
            raise ValueError("Portal URL must start with http(s)://")
        return value
