"""Eligibility matching endpoint."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, User
from app.schemas import MatchRequest, MatchResponse
from app.services import i18n
from app.services.eligibility import evaluate_all
from app.services.profile import get_profile, merge_profile_fields, profile_fields_from_raw
from app.services.scoring import score_results
from app.services.schemes import get_scheme_repository
from app.session import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/match", tags=["eligibility"])


@router.post("", response_model=MatchResponse)
def match_schemes(
    payload: MatchRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MatchResponse:
    """Evaluate every scheme against the saved profile or an unsaved override."""
    language = i18n.normalize_language(
        (payload.language if payload else None) or user.language
    )
    row = get_profile(db, user.id)
    saved = profile_fields_from_raw(row.fields if row else None)
    if payload and payload.fields is not None:
        fields = merge_profile_fields(saved, payload.fields.model_dump(exclude_unset=True))
    else:
        fields = saved

    document_types = list(
        dict.fromkeys(
            db.scalars(select(Document.type).where(Document.user_id == user.id)).all()
        )
    )
    results = evaluate_all(
        get_scheme_repository().all(),
        fields,
        language=language,
        available_document_types=document_types,
    )
    results = score_results(
        get_scheme_repository().all(),
        results,
        fields,
        document_types,
        language=language,
    )

    if user.language != language:
        user.language = language
        db.commit()

    logger.info(
        "Matched %d schemes for user %s (eligible=%d, likely=%d)",
        len(results),
        user.id,
        sum(1 for result in results if result.status == "eligible"),
        sum(1 for result in results if result.status == "likely"),
    )
    return MatchResponse(
        results=results,
        language=language,  # type: ignore[arg-type]
        profile_fields=fields,
        available_documents=document_types,
        generated_at=datetime.now(timezone.utc),
        disclaimer=i18n.t("ui.match_disclaimer", language),
    )
