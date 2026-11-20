"""Pydantic v2 request/response contracts for the Sahayak API."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.scheme import RuleOperator

Language = Literal["en", "hi", "mr"]
Gender = Literal["female", "male", "other"]
Category = Literal["General", "OBC", "SC", "ST", "EWS"]
EducationLevel = Literal[
    "class_8",
    "class_9",
    "class_10",
    "class_11",
    "class_12",
    "undergraduate",
    "postgraduate",
    "diploma",
    "iti",
]
InstitutionType = Literal["government", "government_aided", "private", "municipal", "other"]

_CATEGORY_ALIASES = {
    "general": "General",
    "gen": "General",
    "obc": "OBC",
    "other backward class": "OBC",
    "sc": "SC",
    "scheduled caste": "SC",
    "st": "ST",
    "scheduled tribe": "ST",
    "ews": "EWS",
    "economically weaker section": "EWS",
}

_EDUCATION_ALIASES = {
    "class8": "class_8",
    "class 8": "class_8",
    "8th": "class_8",
    "class9": "class_9",
    "class 9": "class_9",
    "9th": "class_9",
    "class10": "class_10",
    "class 10": "class_10",
    "10th": "class_10",
    "class11": "class_11",
    "class 11": "class_11",
    "11th": "class_11",
    "class12": "class_12",
    "class 12": "class_12",
    "12th": "class_12",
    "undergraduate": "undergraduate",
    "ug": "undergraduate",
    "graduation": "undergraduate",
    "postgraduate": "postgraduate",
    "pg": "postgraduate",
    "diploma": "diploma",
    "iti": "iti",
}

_GENDER_ALIASES = {
    "female": "female",
    "f": "female",
    "woman": "female",
    "girl": "female",
    "male": "male",
    "m": "male",
    "man": "male",
    "boy": "male",
    "other": "other",
    "nonbinary": "other",
    "non-binary": "other",
}

_INSTITUTION_ALIASES = {
    "government": "government",
    "govt": "government",
    "government aided": "government_aided",
    "aided": "government_aided",
    "private": "private",
    "municipal": "municipal",
    "other": "other",
}


class ProfileFields(BaseModel):
    """All profile fields defined by FR-1. Missing values are ``None``."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=120)
    age: int | None = Field(default=None, ge=1, le=120)
    gender: Gender | None = None
    state: str | None = Field(default=None, max_length=80)
    district: str | None = Field(default=None, max_length=80)
    category: Category | None = None
    annual_family_income: int | None = Field(default=None, ge=0, le=1_000_000_000)
    education_level: EducationLevel | None = None
    last_exam_percentage: float | None = Field(default=None, ge=0, le=100)
    course: str | None = Field(default=None, max_length=120)
    institution_type: InstitutionType | None = None
    disability_status: bool | None = None
    bank_account_present: bool | None = None

    @field_validator("name", "state", "district", "course", mode="before")
    @classmethod
    def _clean_text(cls, value: Any) -> Any:
        """Trim text and turn blank strings into ``None``."""
        if isinstance(value, str):
            cleaned = " ".join(value.split())
            return cleaned or None
        return value

    @field_validator("category", mode="before")
    @classmethod
    def _normalize_category(cls, value: Any) -> Any:
        """Normalize category spellings returned by LLMs or typed by users."""
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip()
            return _CATEGORY_ALIASES.get(cleaned.lower(), cleaned)
        return value

    @field_validator("education_level", mode="before")
    @classmethod
    def _normalize_education(cls, value: Any) -> Any:
        """Normalize education labels such as '12th' to canonical values."""
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip().lower().replace("_", " ")
            canonical = _EDUCATION_ALIASES.get(cleaned, cleaned.replace(" ", "_"))
            return canonical
        return value

    @field_validator("gender", mode="before")
    @classmethod
    def _normalize_gender(cls, value: Any) -> Any:
        """Normalize gender labels from free text or LLM output."""
        if value is None:
            return None
        if isinstance(value, str):
            return _GENDER_ALIASES.get(value.strip().lower(), value.strip().lower())
        return value

    @field_validator("institution_type", mode="before")
    @classmethod
    def _normalize_institution(cls, value: Any) -> Any:
        """Normalize institution type labels."""
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip().lower().replace("_", " ")
            return _INSTITUTION_ALIASES.get(cleaned, cleaned.replace(" ", "_"))
        return value

    @field_validator("annual_family_income", "age", mode="before")
    @classmethod
    def _parse_int_like(cls, value: Any) -> Any:
        """Accept numeric strings such as '250000' from LLM providers."""
        if isinstance(value, str):
            cleaned = value.replace(",", "").replace("₹", "").strip()
            if cleaned.isdigit():
                return int(cleaned)
        return value

    @field_validator("last_exam_percentage", mode="before")
    @classmethod
    def _parse_float_like(cls, value: Any) -> Any:
        """Accept percentage strings such as '82.5%' from LLM providers."""
        if isinstance(value, str):
            cleaned = value.replace("%", "").replace(",", "").strip()
            try:
                return float(cleaned)
            except ValueError:
                return value
        return value

    def as_clean_dict(self) -> dict[str, Any]:
        """Return only populated fields as JSON-safe values."""
        return self.model_dump(exclude_none=True)


class SessionCreate(BaseModel):
    """Optional payload when creating an anonymous session."""

    language: Language | None = None


class SessionResponse(BaseModel):
    """Session identity and cookie-backed language preference."""

    user_id: str
    language: Language
    created_at: datetime


class ProfileUpdateRequest(BaseModel):
    """Partial profile update; omitted fields stay unchanged."""

    fields: ProfileFields | None = None
    language: Language | None = None


class ProfileResponse(BaseModel):
    """Stored profile plus a completeness indicator."""

    user_id: str
    language: Language
    fields: ProfileFields
    updated_at: datetime | None = None
    completeness: float = Field(ge=0, le=1)
    missing_fields: list[str] = Field(default_factory=list)


class FromTextRequest(BaseModel):
    """Free-form speech transcript or typed profile description."""

    text: str = Field(min_length=1, max_length=5000)
    language: Language | None = None


class FromTextResponse(BaseModel):
    """Proposed profile changes that the user must confirm before saving."""

    updates: dict[str, Any] = Field(default_factory=dict)
    confidence: dict[str, float] = Field(default_factory=dict)
    fields: ProfileFields
    missing_fields: list[str] = Field(default_factory=list)
    message: str
    follow_up_questions: list[str] = Field(default_factory=list)
    provider: str


class SchemeListResponse(BaseModel):
    """List of trilingual scheme definitions."""

    schemes: list[dict[str, Any]]
    count: int


class SchemeDetailResponse(BaseModel):
    """Full scheme definition, including rules and rights."""

    scheme: dict[str, Any]


class PortalListResponse(BaseModel):
    """Official scholarship portals shown as an external directory."""

    portals: list[dict[str, Any]]
    count: int


class RuleResult(BaseModel):
    """One evaluated eligibility rule with a localized explanation."""

    field: str
    operator: RuleOperator
    expected: Any = None
    actual: Any = None
    outcome: Literal["passed", "failed", "unknown"]
    reason_key: str
    reason: str


class RequiredDocumentResult(BaseModel):
    """A required document type with its localized display label."""

    type: str
    label: str


class EligibilityResult(BaseModel):
    """Ranked eligibility outcome for one scheme."""

    scheme_id: str
    scheme_name: str
    short_name: str
    authority: str
    benefit_amount_per_year: int
    deadline: date
    status: Literal["eligible", "likely", "not_eligible"]
    status_reason: str
    status_summary: str
    passed_rules: list[RuleResult] = Field(default_factory=list)
    failed_rules: list[RuleResult] = Field(default_factory=list)
    unknown_rules: list[RuleResult] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    missing_field_labels: list[str] = Field(default_factory=list)
    missing_documents: list[str] = Field(default_factory=list)
    missing_document_labels: list[str] = Field(default_factory=list)
    required_documents: list[RequiredDocumentResult] = Field(default_factory=list)
    total_rules: int
    passed_count: int
    failed_count: int
    unknown_count: int
    source_url: str
    apply_url: str
    rank: int = 0
    match_score: int = Field(default=0, ge=0, le=100)
    match_status: Literal["eligible", "likely", "not_eligible"] = "likely"
    score_factors_up: list[str] = Field(default_factory=list)
    score_factors_down: list[str] = Field(default_factory=list)


class MatchRequest(BaseModel):
    """Optional unsaved profile override used for live previews."""

    fields: ProfileFields | None = None
    language: Language | None = None


class MatchResponse(BaseModel):
    """Ranked eligibility results across every loaded scheme."""

    results: list[EligibilityResult]
    language: Language
    profile_fields: ProfileFields
    available_documents: list[str] = Field(default_factory=list)
    generated_at: datetime
    disclaimer: str


class DocumentIssue(BaseModel):
    """A localized document validation finding."""

    document_type: str
    field: str | None = None
    severity: Literal["warning", "blocking"] 
    reason: str
    fix_suggestion: str


class DocumentCheckResponse(BaseModel):
    """Document readiness and cross-document consistency for one scheme."""

    scheme_id: str
    missing_documents: list[str] = Field(default_factory=list)
    expired_documents: list[str] = Field(default_factory=list)
    mismatches: list[DocumentIssue] = Field(default_factory=list)
    readiness_percentage: int = Field(ge=0, le=100)
    blocking: bool


class DeleteMeResponse(BaseModel):
    """Summary of personal data removed by the privacy action."""

    deleted: dict[str, int]
    message: str


class HealthResponse(BaseModel):
    """Lightweight service health information."""

    status: Literal["ok"]
    version: str
    llm_provider: str
    schemes_loaded: int


class ErrorResponse(BaseModel):
    """Uniform error envelope returned by custom API handlers."""

    error: dict[str, str]


class MessageResponse(BaseModel):
    """Simple message payload."""

    message: str


class SchemeValidationRequest(BaseModel):
    """Admin payload for validating an edited scheme before saving."""

    scheme: dict[str, Any]

    @model_validator(mode="after")
    def _must_be_object(self) -> "SchemeValidationRequest":
        """Ensure the incoming scheme is a JSON object."""
        if not isinstance(self.scheme, dict):
            raise ValueError("scheme must be a JSON object")
        return self
