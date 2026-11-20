"""Deterministic document readiness and consistency checks."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from difflib import SequenceMatcher
from typing import Any

from app.models.db import Document
from app.models.scheme import Scheme
from app.schemas import DocumentCheckResponse, DocumentIssue
from app.services import i18n


_CROSS_CHECK_FIELDS = {
    "applicant_name": "name",
    "name": "name",
    "date_of_birth": "date_of_birth",
    "gender": "gender",
}


def _normalized(value: Any) -> str:
    """Normalize identifiers without retaining their original formatting."""
    return " ".join(str(value).casefold().split())


def _severity(field: str, values: list[str]) -> str:
    """Classify a difference as exact, minor, or major."""
    if len(set(values)) <= 1:
        return "exact"
    if field == "date_of_birth":
        return "major"
    if field == "name":
        first, second = values[0].split(), values[1].split()
        if first and second and first[-1] == second[-1]:
            first_initial = first[0].rstrip(".")[:1]
            second_initial = second[0].rstrip(".")[:1]
            if first_initial and first_initial == second_initial:
                return "minor"
    similarity = SequenceMatcher(None, values[0], values[1]).ratio()
    return "minor" if similarity >= 0.8 else "major"


def _expiry(document: Document, today: date) -> bool:
    """Return whether a document is expired or expires within thirty days."""
    if document.expires_at.date() <= today + timedelta(days=30):
        return True
    extracted = document.extracted or {}
    valid_until = extracted.get("valid_until")
    if isinstance(valid_until, str):
        try:
            return date.fromisoformat(valid_until) <= today + timedelta(days=30)
        except ValueError:
            return False
    return False


def check_documents(
    scheme: Scheme,
    documents: list[Document],
    language: str = "en",
    today: date | None = None,
) -> DocumentCheckResponse:
    """Check required documents, expiry, and identity consistency."""
    today = today or datetime.now(timezone.utc).date()
    by_type = {document.type: document for document in documents}
    missing = [
        document.type
        for document in scheme.required_documents
        if document.type not in by_type
    ]
    expired = [
        document.type
        for document in documents
        if document.type in {item.type for item in scheme.required_documents}
        and _expiry(document, today)
    ]

    issues: list[DocumentIssue] = []
    for field, canonical in _CROSS_CHECK_FIELDS.items():
        values = [
            _normalized(document.extracted[field])
            for document in documents
            if field in document.extracted and document.extracted[field] not in (None, "")
        ]
        if len(values) < 2:
            continue
        difference = _severity(canonical, values)
        if difference == "exact":
            continue
        blocking = difference == "major"
        issues.append(
            DocumentIssue(
                document_type="cross_document",
                field=canonical,
                severity="blocking" if blocking else "warning",
                reason=i18n.t(
                    f"documents.mismatch_{difference}",
                    language,
                    field=i18n.field_label(canonical, language),
                ),
                fix_suggestion=i18n.t(
                    "documents.mismatch_fix",
                    language,
                ),
            )
        )

    total = len(scheme.required_documents)
    ready = max(0, total - len(set(missing) | set(expired)))
    readiness = round(ready / total * 100) if total else 100
    return DocumentCheckResponse(
        scheme_id=scheme.id,
        missing_documents=missing,
        expired_documents=expired,
        mismatches=issues,
        readiness_percentage=readiness,
        blocking=any(issue.severity == "blocking" for issue in issues),
    )
