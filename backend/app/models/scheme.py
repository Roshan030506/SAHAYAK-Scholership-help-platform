"""Pydantic models describing the editable scheme JSON format."""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Any

from pydantic import ValidationError
from pydantic import BaseModel, Field, field_validator, model_validator


class RuleOperator(str, Enum):
    """Operators supported by the deterministic eligibility engine."""

    EQ = "eq"
    IN = "in"
    LT = "lt"
    LTE = "lte"
    GT = "gt"
    GTE = "gte"
    BETWEEN = "between"
    EXISTS = "exists"
    CONTAINS_ANY = "contains_any"


class LocalizedText(BaseModel):
    """A short piece of content available in all supported languages."""

    en: str = Field(min_length=1)
    hi: str = Field(min_length=1)
    mr: str = Field(min_length=1)


class SchemeRule(BaseModel):
    """One deterministic eligibility condition."""

    field: str = Field(min_length=1)
    operator: RuleOperator
    value: Any = None
    label: LocalizedText
    weight: int = Field(default=1, ge=1, le=10)
    mandatory: bool = False

    @model_validator(mode="after")
    def _validate_operand(self) -> "SchemeRule":
        """Ensure operands are well formed for collection operators."""
        if self.operator in {RuleOperator.IN, RuleOperator.BETWEEN, RuleOperator.CONTAINS_ANY}:
            if not isinstance(self.value, list) or not self.value:
                raise ValueError(f"Rule operator '{self.operator.value}' requires a non-empty list")
        if self.operator == RuleOperator.BETWEEN and len(self.value) != 2:
            raise ValueError("'between' requires exactly two boundary values")
        if self.operator not in {RuleOperator.EXISTS} and self.value is None:
            raise ValueError(f"Rule operator '{self.operator.value}' requires a value")
        return self


class RequiredDocument(BaseModel):
    """A document required by a scheme with a trilingual label."""

    type: str = Field(min_length=1)
    label: LocalizedText
    validity_days: int | None = Field(default=None, ge=1)
    required_fields: list[str] = Field(default_factory=list)

    @field_validator("required_fields", mode="before")
    @classmethod
    def _normalize_required_fields(cls, value: Any) -> Any:
        """Treat null from older JSON editors as an empty field list."""
        return [] if value is None else value


class RightItem(BaseModel):
    """A citizen right or appeal step attached to a scheme."""

    title: LocalizedText
    detail: LocalizedText


class GrievanceContact(BaseModel):
    """Official grievance channel shown in the rights card."""

    name: str
    phone: str
    email: str
    address: str


class Scheme(BaseModel):
    """Complete scheme definition loaded from ``data/schemes/*.json``."""

    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,63}$")
    name: LocalizedText
    short_name: LocalizedText
    authority: LocalizedText
    description: LocalizedText
    benefit_amount_per_year: int = Field(ge=0)
    deadline: date
    deadline_timezone: str = Field(default="Asia/Kolkata", min_length=1)
    rules: list[SchemeRule] = Field(min_length=1)
    required_documents: list[RequiredDocument] = Field(default_factory=list)
    rights: list[RightItem] = Field(default_factory=list)
    grievance_contact: GrievanceContact
    source_url: str = Field(min_length=8)
    apply_url: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)

    @field_validator("source_url", "apply_url")
    @classmethod
    def _validate_url_like(cls, value: str) -> str:
        """Accept absolute HTTP(S) URLs or local absolute paths."""
        value = value.strip()
        if not (value.startswith("https://") or value.startswith("http://") or value.startswith("/")):
            raise ValueError("URL must start with http(s):// or /")
        return value

    @field_validator("rules")
    @classmethod
    def _unique_rule_fields(cls, rules: list[SchemeRule]) -> list[SchemeRule]:
        """Reject duplicate field/operator pairs that make reasons confusing."""
        seen: set[tuple[str, str]] = set()
        for rule in rules:
            key = (rule.field, rule.operator.value)
            if key in seen:
                raise ValueError(f"Duplicate rule for {key[0]} / {key[1]}")
            seen.add(key)
        return rules
