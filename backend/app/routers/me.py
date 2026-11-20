"""Privacy endpoint that permanently removes all data for the session."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Application, AuditEvent, Document, Profile, StatusEvent, User
from app.schemas import DeleteMeResponse
from app.session import clear_session_cookie, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/me", tags=["privacy"])


def _unlink_private_file(path_value: str | None) -> bool:
    """Delete a file only when it lives inside the app's data directory."""
    if not path_value:
        return False
    try:
        path = Path(path_value)
        if not path.is_absolute():
            path = Path.cwd() / path
        resolved = path.resolve()
        resolved.relative_to(settings.data_dir.resolve())
    except (OSError, ValueError):
        logger.warning("Refused to delete a file outside the data directory")
        return False
    try:
        if resolved.is_file():
            resolved.unlink()
            return True
    except OSError:
        logger.exception("Could not delete private file")
    return False


@router.delete("", response_model=DeleteMeResponse)
def delete_my_data(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DeleteMeResponse:
    """Wipe the profile, uploaded documents, applications, audit and status data."""
    applications = db.scalars(select(Application).where(Application.user_id == user.id)).all()
    application_ids = [application.id for application in applications]
    documents = db.scalars(select(Document).where(Document.user_id == user.id)).all()
    profile = db.get(Profile, user.id)

    file_paths = [document.path for document in documents]
    file_paths.extend(application.receipt_path for application in applications)

    audit_count = 0
    status_count = 0
    if application_ids:
        audit_count = (
            db.execute(
                delete(AuditEvent).where(AuditEvent.application_id.in_(application_ids))
            ).rowcount
            or 0
        )
        status_count = (
            db.execute(
                delete(StatusEvent).where(StatusEvent.application_id.in_(application_ids))
            ).rowcount
            or 0
        )
        db.execute(delete(Application).where(Application.id.in_(application_ids)))
    if documents:
        db.execute(delete(Document).where(Document.user_id == user.id))
    if profile:
        db.execute(delete(Profile).where(Profile.user_id == user.id))
    db.delete(user)
    db.commit()

    removed_files = sum(1 for path in file_paths if _unlink_private_file(path))
    clear_session_cookie(response)
    logger.info(
        "Deleted data for user %s: %d applications, %d documents, %d files",
        user.id,
        len(applications),
        len(documents),
        removed_files,
    )
    return DeleteMeResponse(
        deleted={
            "profile": 1 if profile else 0,
            "documents": len(documents),
            "applications": len(applications),
            "audit_events": audit_count,
            "status_events": status_count,
            "files": removed_files,
        },
        message="Your profile, documents and applications have been deleted.",
    )
