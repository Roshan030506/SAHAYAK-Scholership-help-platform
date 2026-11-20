"""Signed-cookie anonymous session helpers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Depends, HTTPException, Request, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)

_SALT = "sahayak.session.v1"
_serializer = URLSafeTimedSerializer(settings.secret_key, salt=_SALT)


def sign_session(user_id: str) -> str:
    """Create a signed, timestamped session token for a user id."""
    return _serializer.dumps({"uid": user_id})


def verify_session(token: str) -> str | None:
    """Return the user id from a valid token, or ``None`` when invalid/expired."""
    try:
        data: Any = _serializer.loads(token, max_age=settings.session_max_age_seconds)
    except SignatureExpired:
        logger.info("Session cookie expired")
        return None
    except BadSignature:
        logger.warning("Rejected session cookie with an invalid signature")
        return None
    if not isinstance(data, dict) or not isinstance(data.get("uid"), str):
        return None
    return data["uid"]


def attach_session_cookie(response: Response, user_id: str) -> None:
    """Set the HTTP-only signed session cookie on a response."""
    response.set_cookie(
        key=settings.session_cookie_name,
        value=sign_session(user_id),
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    """Delete the session cookie from the browser."""
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite="lax",
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """FastAPI dependency returning the authenticated anonymous user.

    Raises a 401 response when the cookie is missing, invalid or points to a
    deleted user (for example after ``DELETE /api/me``).
    """
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "session_required", "message": "Create a session first."},
        )
    user_id = verify_session(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_session", "message": "Your session has expired. Please start again."},
        )
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "unknown_session", "message": "Session not found. Please start again."},
        )
    return user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    """Return the current user when present, without raising for anonymous calls."""
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    user_id = verify_session(token)
    if not user_id:
        return None
    return db.get(User, user_id)
