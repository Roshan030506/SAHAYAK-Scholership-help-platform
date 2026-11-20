"""API integration tests for session, profile, match, schemes and privacy."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.config import settings
from app.database import SessionLocal
from app.models import Application, AuditEvent, Document, StatusEvent, User

FULL_PROFILE = {
    "name": "Riya Patil",
    "age": 19,
    "gender": "female",
    "state": "Maharashtra",
    "district": "Pune",
    "category": "SC",
    "annual_family_income": 200000,
    "education_level": "undergraduate",
    "last_exam_percentage": 82.4,
    "course": "B.Sc",
    "institution_type": "government",
    "disability_status": False,
    "bank_account_present": True,
}


def test_health_reports_mock_mode(client):
    """Health exposes version, provider and scheme count."""
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["llm_provider"] == "mock"
    assert body["schemes_loaded"] == 14


def test_profile_requires_session(client):
    """Anonymous users must create a session before reading profile data."""
    response = client.get("/api/profile")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "session_required"


def test_session_is_idempotent_and_cookie_is_httponly(client):
    """A second POST returns the existing session and the cookie is protected."""
    first = client.post("/api/session", json={"language": "hi"})
    second = client.post("/api/session", json={"language": "hi"})
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["user_id"] == second.json()["user_id"]
    cookie_header = first.headers["set-cookie"].lower()
    assert settings.session_cookie_name in cookie_header
    assert "httponly" in cookie_header


def test_profile_update_and_read(session_client):
    """Confirmed fields persist and completeness reaches 100%."""
    response = session_client.put("/api/profile", json={"fields": FULL_PROFILE})
    assert response.status_code == 200
    body = response.json()
    assert body["completeness"] == 1.0
    assert body["fields"]["name"] == "Riya Patil"
    assert body["missing_fields"] == []

    read = session_client.get("/api/profile")
    assert read.status_code == 200
    assert read.json()["fields"]["category"] == "SC"


def test_profile_partial_update_merges(session_client):
    """A partial update keeps previously confirmed values."""
    session_client.put("/api/profile", json={"fields": {"name": "Riya", "age": 19}})
    response = session_client.put(
        "/api/profile", json={"fields": {"state": "Maharashtra"}}
    )
    fields = response.json()["fields"]
    assert fields["name"] == "Riya"
    assert fields["age"] == 19
    assert fields["state"] == "Maharashtra"


def test_profile_language_only_update(session_client):
    """Language can be changed without touching profile values."""
    session_client.put("/api/profile", json={"fields": {"name": "Riya"}})
    response = session_client.put("/api/profile", json={"language": "mr"})
    assert response.status_code == 200
    assert response.json()["language"] == "mr"
    assert response.json()["fields"]["name"] == "Riya"


def test_profile_validation_rejects_bad_percentage(session_client):
    """Server-side validation blocks impossible percentages."""
    response = session_client.put(
        "/api/profile", json={"fields": {"last_exam_percentage": 120}}
    )
    assert response.status_code == 422


def test_profile_validation_rejects_negative_income(session_client):
    """Server-side validation blocks negative income."""
    response = session_client.put(
        "/api/profile", json={"fields": {"annual_family_income": -1}}
    )
    assert response.status_code == 422


def test_from_text_extracts_preview_without_saving(session_client):
    """FR-3 returns proposed updates; the user must confirm them."""
    text = (
        "My name is Riya Patil. I am 19 years old, a girl from Pune, Maharashtra. "
        "I belong to SC category. My family income is 200000. "
        "I passed 12th with 82 percent and I am studying B.Sc in a government college."
    )
    response = session_client.post(
        "/api/profile/from-text", json={"text": text, "language": "en"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "mock"
    assert body["updates"]["age"] == 19
    assert body["updates"]["annual_family_income"] == 200000
    assert body["updates"]["category"] == "SC"
    assert body["updates"]["state"] == "Maharashtra"
    assert all(0 <= value <= 1 for value in body["confidence"].values())

    profile = session_client.get("/api/profile").json()
    assert profile["fields"]["name"] is None


def test_from_text_supports_marathi(session_client):
    """The mock provider extracts the Marathi demo sentence."""
    text = (
        "मी पुण्यातील १९ वर्षांची मुलगी आहे. माझे नाव रिया पाटील आहे. "
        "मी अनुसूचित जातीची आहे. कुटुंबाचे वार्षिक उत्पन्न सुमारे ६ लाख आहे. "
        "मी १२वी ८२ टक्के गुणांनी उत्तीर्ण झाले."
    )
    response = session_client.post(
        "/api/profile/from-text", json={"text": text, "language": "mr"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["updates"]["gender"] == "female"
    assert body["updates"]["annual_family_income"] == 600000
    assert body["updates"]["state"] == "Maharashtra"
    assert body["updates"]["last_exam_percentage"] == 82


def test_scheme_list_and_detail(session_client):
    """The catalogue exposes every complete scheme."""
    listing = session_client.get("/api/schemes")
    assert listing.status_code == 200
    body = listing.json()
    assert body["count"] == 14
    assert len(body["schemes"]) == 14

    detail = session_client.get("/api/schemes/post-matric-sc")
    assert detail.status_code == 200
    scheme = detail.json()["scheme"]
    assert scheme["name"]["en"]
    assert scheme["source_url"].startswith("http")


def test_unknown_scheme_returns_404(session_client):
    """Unknown ids produce a structured 404."""
    response = session_client.get("/api/schemes/not-a-scheme")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "scheme_not_found"


def test_match_returns_ranked_trilingual_results(session_client):
    """Matching ranks by benefit and localizes reasons and disclaimers."""
    session_client.put("/api/profile", json={"fields": FULL_PROFILE})
    response = session_client.post("/api/match", json={"language": "hi"})
    assert response.status_code == 200
    body = response.json()
    assert body["language"] == "hi"
    assert len(body["results"]) == 14
    assert [result["rank"] for result in body["results"]] == list(range(1, 15))
    benefits = [result["benefit_amount_per_year"] for result in body["results"]]
    assert benefits == sorted(benefits, reverse=True)
    assert any("पात्र" in result["status_reason"] for result in body["results"])
    assert body["results"][0]["status_summary"]
    assert body["disclaimer"]


def test_match_accepts_unsaved_preview_fields(session_client):
    """Live previews can match without persisting the profile."""
    response = session_client.post(
        "/api/match", json={"fields": FULL_PROFILE, "language": "en"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["profile_fields"]["name"] == "Riya Patil"
    assert sum(1 for result in body["results"] if result["status"] == "eligible") == 6

    profile = session_client.get("/api/profile").json()
    assert profile["fields"]["name"] is None


def test_match_with_empty_profile_is_likely_everywhere(session_client):
    """No profile data yields likely results, never false rejections."""
    response = session_client.post("/api/match", json={"language": "en"})
    assert response.status_code == 200
    assert all(result["status"] == "likely" for result in response.json()["results"])


def test_match_persists_language_preference(session_client):
    """The session language follows the last result language."""
    session_client.post("/api/match", json={"language": "mr"})
    profile = session_client.get("/api/profile")
    assert profile.json()["language"] == "mr"


def test_delete_my_data_wipes_everything(session_client):
    """FR-20 removes profile, documents, applications, audit/status and files."""
    session_client.put("/api/profile", json={"fields": FULL_PROFILE})
    user_id = session_client.get("/api/session").json()["user_id"]

    settings.document_dir.mkdir(parents=True, exist_ok=True)
    settings.receipt_dir.mkdir(parents=True, exist_ok=True)
    document_path = settings.document_dir / "sample-income.png"
    receipt_path = settings.receipt_dir / "receipt.pdf"
    document_path.write_bytes(b"synthetic-image-bytes")
    receipt_path.write_bytes(b"%PDF-1.4 demo receipt")

    with SessionLocal() as db:
        db.add(
            Document(
                user_id=user_id,
                type="income_certificate",
                path=str(document_path),
                extracted={"annual_income": 200000},
                confidence={"annual_income": 0.95},
                expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
            )
        )
        application = Application(
            user_id=user_id,
            scheme_id="post-matric-sc",
            status="submitted",
            draft={"profile": {"name": "Riya Patil"}},
            receipt_path=str(receipt_path),
        )
        db.add(application)
        db.flush()
        db.add(
            AuditEvent(
                application_id=application.id,
                actor="agent",
                action="filled_field",
                detail={"field": "name", "masked": "R***"},
            )
        )
        db.add(StatusEvent(application_id=application.id, status="submitted"))
        db.commit()

    response = session_client.delete("/api/me")
    assert response.status_code == 200
    deleted = response.json()["deleted"]
    assert deleted["profile"] == 1
    assert deleted["documents"] == 1
    assert deleted["applications"] == 1
    assert deleted["audit_events"] == 1
    assert deleted["status_events"] == 1
    assert deleted["files"] == 2
    assert not document_path.exists()
    assert not receipt_path.exists()

    with SessionLocal() as db:
        assert db.get(User, user_id) is None

    after = session_client.get("/api/profile")
    assert after.status_code == 401


def test_cors_allows_frontend_origin(client):
    """The Vite dev origin can call the API with credentials."""
    response = client.options(
        "/api/profile",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"
