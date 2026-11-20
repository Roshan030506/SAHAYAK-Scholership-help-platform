"""Shared pytest fixtures for the Sahayak backend test suite."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

TEST_ROOT = Path(tempfile.mkdtemp(prefix="sahayak-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(TEST_ROOT / 'test.db').as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only"
os.environ["LLM_PROVIDER"] = "mock"
os.environ["LOG_LEVEL"] = "WARNING"
os.environ["DATA_DIR"] = str(TEST_ROOT / "data")
os.environ["DOCUMENT_DIR"] = str(TEST_ROOT / "data" / "documents")
os.environ["RECEIPT_DIR"] = str(TEST_ROOT / "data" / "receipts")
os.environ["SCREENSHOT_DIR"] = str(TEST_ROOT / "data" / "screenshots")

from fastapi.testclient import TestClient  # noqa: E402

from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.scheme import LocalizedText, Scheme, SchemeRule  # noqa: E402
from app.services.schemes import get_scheme_repository  # noqa: E402


@pytest.fixture()
def client():
    """Provide a TestClient with a freshly recreated SQLite database."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def session_client(client: TestClient) -> TestClient:
    """A client with an established anonymous session."""
    response = client.post("/api/session", json={"language": "en"})
    assert response.status_code == 200, response.text
    return client


@pytest.fixture(scope="session")
def schemes() -> list[Scheme]:
    """All validated scheme definitions."""
    return get_scheme_repository().all()


def localized(text: str) -> LocalizedText:
    """Build a trilingual label with the same text in all languages."""
    return LocalizedText(en=text, hi=text, mr=text)


def make_scheme(
    *,
    scheme_id: str,
    benefit: int,
    deadline: str = "2026-12-31",
    rules: list[SchemeRule] | None = None,
) -> Scheme:
    """Build a complete synthetic scheme for unit tests."""
    return Scheme(
        id=scheme_id,
        name=localized(f"Scheme {scheme_id}"),
        short_name=localized(scheme_id),
        authority=localized("Test Authority"),
        description=localized("Test description"),
        benefit_amount_per_year=benefit,
        deadline=deadline,
        rules=rules
        or [
            SchemeRule(
                field="category",
                operator="exists",
                label=localized("Category is present"),
            )
        ],
        required_documents=[],
        rights=[],
        grievance_contact={
            "name": "Test Helpdesk",
            "phone": "0000",
            "email": "help@example.test",
            "address": "Test",
        },
        source_url="https://example.test/scheme",
        apply_url="/mock-portal/login",
    )


def make_rule(field: str, operator: str, value=None) -> SchemeRule:
    """Build a synthetic rule with a stable localized label."""
    return SchemeRule(
        field=field,
        operator=operator,
        value=value,
        label=localized(f"{field} {operator}"),
    )
