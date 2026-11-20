"""Tests for the official scholarship portal directory."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.portals import PortalRepository, PortalRepositoryError, get_portal_repository

EXPECTED_PORTAL_IDS = {
    "national-scholarship-portal",
    "mahadbt-scholarship-portal",
    "myscheme-discovery-portal",
    "tribal-affairs-scholarship-portal",
    "aicte-fellowship-portal",
    "social-justice-samavesh",
    "dwbdnc-scholarship-portal",
    "buddy4study-scholarship-portal",
    "vidyasaarathi-scholarship-portal",
    "scholarsbox-scholarship-portal",
}


def test_portal_endpoint_lists_curated_directory(client):
    """The portal directory is available without a session."""
    response = client.get("/api/portals")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 10
    assert len(body["portals"]) == 10
    assert {portal["id"] for portal in body["portals"]} == EXPECTED_PORTAL_IDS


def test_portals_have_trilingual_content_and_official_links(client):
    """Every portal is usable in all three languages and links to http(s)."""
    portals = client.get("/api/portals").json()["portals"]
    for portal in portals:
        assert portal["url"].startswith("https://"), portal["id"]
        assert portal["group"] in {"central", "state", "csr", "discovery"}
        assert portal["tags"]
        for field in ("name", "short_name", "authority", "description"):
            for language in ("en", "hi", "mr"):
                assert portal[field][language].strip(), (portal["id"], field, language)


def test_portal_repository_rejects_invalid_url(tmp_path: Path):
    """An unsafe external link fails loudly instead of rendering."""
    payload = [
        {
            "id": "unsafe-portal",
            "name": {"en": "Unsafe", "hi": "असुरक्षित", "mr": "असुरक्षित"},
            "short_name": {"en": "Unsafe", "hi": "असुरक्षित", "mr": "असुरक्षित"},
            "authority": {"en": "Test", "hi": "परीक्षण", "mr": "चाचणी"},
            "description": {"en": "Test", "hi": "परीक्षण", "mr": "चाचणी"},
            "url": "javascript:alert(1)",
            "group": "central",
            "tags": ["test"],
        }
    ]
    path = tmp_path / "portals.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(PortalRepositoryError):
        PortalRepository(path).reload()


def test_portal_repository_rejects_duplicate_ids(tmp_path: Path):
    """Duplicate ids would make list keys unstable."""
    portal = {
        "id": "duplicate-portal",
        "name": {"en": "Duplicate", "hi": "डुप्लिकेट", "mr": "डुप्लिकेट"},
        "short_name": {"en": "Duplicate", "hi": "डुप्लिकेट", "mr": "डुप्लिकेट"},
        "authority": {"en": "Test", "hi": "परीक्षण", "mr": "चाचणी"},
        "description": {"en": "Test", "hi": "परीक्षण", "mr": "चाचणी"},
        "url": "https://example.gov.in/",
        "group": "central",
        "tags": ["test"],
    }
    path = tmp_path / "portals.json"
    path.write_text(json.dumps([portal, portal]), encoding="utf-8")
    with pytest.raises(PortalRepositoryError):
        PortalRepository(path).reload()


def test_shared_portal_repository_count():
    """The application repository exposes the bundled portal count."""
    assert get_portal_repository().count() == 10
