"""Focused tests for deterministic document readiness checks."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import Document
from app.services.doc_check import check_documents
from tests.conftest import get_scheme_repository


def _document(document_type: str, extracted: dict, expires_in_days: int = 365) -> Document:
    return Document(
        user_id="test-user",
        type=document_type,
        path=f"/tmp/{document_type}.png",
        extracted=extracted,
        confidence={},
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_in_days),
    )


def test_name_initial_is_minor_and_different_dob_is_blocking():
    scheme = get_scheme_repository().get("post-matric-sc")
    assert scheme is not None
    documents = [
        _document(
            "marksheet",
            {"applicant_name": "Rohan Patil", "date_of_birth": "2005-01-02"},
        ),
        _document(
            "income_certificate",
            {"applicant_name": "R. Patil", "date_of_birth": "2005-02-02"},
        ),
    ]

    result = check_documents(scheme, documents, today=datetime.now(timezone.utc).date())

    assert any(issue.field == "name" and issue.severity == "warning" for issue in result.mismatches)
    assert any(issue.field == "date_of_birth" and issue.severity == "blocking" for issue in result.mismatches)
    assert result.blocking is True


def test_expiring_document_reduces_readiness():
    scheme = get_scheme_repository().get("post-matric-sc")
    assert scheme is not None
    documents = [
        _document("caste_certificate", {"applicant_name": "Rohan Patil"}, expires_in_days=10),
        _document("income_certificate", {"applicant_name": "Rohan Patil"}, expires_in_days=365),
        _document("marksheet", {"applicant_name": "Rohan Patil"}, expires_in_days=365),
    ]

    result = check_documents(scheme, documents)

    assert "caste_certificate" in result.expired_documents
    assert result.readiness_percentage == 67
