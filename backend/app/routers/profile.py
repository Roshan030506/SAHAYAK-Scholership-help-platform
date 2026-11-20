"""Profile read, update and free-text extraction endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.llm.base import LLMProviderError
from app.llm.factory import get_llm_provider
from app.models import User
from app.schemas import (
    FromTextRequest,
    FromTextResponse,
    ProfileResponse,
    ProfileUpdateRequest,
)
from app.services import i18n
from app.services.profile import (
    build_profile_response,
    get_profile,
    merge_profile_fields,
    missing_core_fields,
    profile_fields_from_raw,
    sanitize_updates,
    save_profile,
)
from app.session import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
def read_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """Return the current user's saved profile."""
    row = get_profile(db, user.id)
    return build_profile_response(user, row)


@router.put("", response_model=ProfileResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """Merge confirmed profile fields and/or language into the session."""
    updates = payload.fields.model_dump(exclude_unset=True) if payload.fields is not None else {}
    response = save_profile(db, user, updates, payload.language)
    logger.info("Updated profile for user %s with %d field(s)", user.id, len(updates))
    return response


@router.post("/from-text", response_model=FromTextResponse)
async def extract_profile_from_text(
    payload: FromTextRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FromTextResponse:
    """Extract proposed profile fields from typed or spoken text.

    The extraction is not saved automatically: the client shows the values for
    user confirmation and then calls ``PUT /api/profile``.
    """
    language = i18n.normalize_language(payload.language or user.language)
    try:
        provider = get_llm_provider()
        extraction = await provider.extract_profile(text=payload.text, language=language)
    except LLMProviderError as exc:
        logger.warning("Profile extraction provider error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "llm_unavailable", "message": str(exc)},
        ) from exc

    updates = sanitize_updates(extraction.updates)
    confidence = {
        key: round(min(max(float(value), 0.0), 1.0), 3)
        for key, value in extraction.confidence.items()
        if key in updates
    }

    row = get_profile(db, user.id)
    existing = profile_fields_from_raw(row.fields if row else None)
    preview = merge_profile_fields(existing, updates)
    message = extraction.summary or i18n.t(
        "from_text.found" if updates else "from_text.no_fields",
        language,
        count=len(updates),
    )

    logger.info(
        "Extracted %d profile field(s) for user %s via %s",
        len(updates),
        user.id,
        provider.name,
    )
    return FromTextResponse(
        updates=updates,
        confidence=confidence,
        fields=preview,
        missing_fields=missing_core_fields(preview),
        message=message,
        follow_up_questions=extraction.follow_up_questions[:3],
        provider=provider.name,
    )
