"""Scheme catalogue endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas import SchemeDetailResponse, SchemeListResponse
from app.services.i18n import normalize_language
from app.services.schemes import get_scheme_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schemes", tags=["schemes"])


@router.get("", response_model=SchemeListResponse)
def list_schemes(language: str | None = Query(default=None, max_length=8)) -> SchemeListResponse:
    """List every loaded scheme with all trilingual content."""
    normalized = normalize_language(language)
    schemes = get_scheme_repository().all_dicts()
    logger.debug("Listing %d schemes (language=%s)", len(schemes), normalized)
    return SchemeListResponse(schemes=schemes, count=len(schemes))


@router.get("/{scheme_id}", response_model=SchemeDetailResponse)
def get_scheme(scheme_id: str) -> SchemeDetailResponse:
    """Return one scheme by id."""
    scheme = get_scheme_repository().get(scheme_id)
    if scheme is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "scheme_not_found", "message": f"Unknown scheme '{scheme_id}'."},
        )
    return SchemeDetailResponse(scheme=scheme.model_dump(mode="json"))
