"""Anonymous session endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import SessionCreate, SessionResponse
from app.services import i18n
from app.session import attach_session_cookie, get_current_user, verify_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/session", tags=["session"])


def _session_response(user: User) -> SessionResponse:
    """Map a user ORM row to the session response model."""
    return SessionResponse(
        user_id=user.id,
        language=i18n.normalize_language(user.language),  # type: ignore[arg-type]
        created_at=user.created_at,
    )


@router.post("", response_model=SessionResponse)
def create_session(
    request: Request,
    response: Response,
    payload: SessionCreate | None = None,
    db: Session = Depends(get_db),
) -> SessionResponse:
    """Create a session or return the caller's existing anonymous session."""
    language = i18n.normalize_language(payload.language if payload else "en")
    user: User | None = None
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        user_id = verify_session(token)
        if user_id:
            user = db.get(User, user_id)

    if user is None:
        user = User(language=language)
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("Created anonymous session %s (language=%s)", user.id, language)
    elif payload and payload.language and user.language != payload.language:
        user.language = language
        db.commit()
        db.refresh(user)

    attach_session_cookie(response, user.id)
    return _session_response(user)


@router.get("", response_model=SessionResponse)
def read_session(user: User = Depends(get_current_user)) -> SessionResponse:
    """Return the current anonymous session identity."""
    return _session_response(user)


@router.post("/refresh", response_model=SessionResponse)
def refresh_session(
    response: Response,
    user: User = Depends(get_current_user),
) -> SessionResponse:
    """Re-issue a fresh signed cookie for the current session."""
    attach_session_cookie(response, user.id)
    return _session_response(user)
