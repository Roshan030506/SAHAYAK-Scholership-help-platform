"""Document readiness endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, User
from app.schemas import DocumentCheckResponse
from app.services import i18n
from app.services.doc_check import check_documents
from app.services.schemes import get_scheme_repository
from app.session import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/check", response_model=DocumentCheckResponse)
def check_uploaded_documents(
    scheme_id: str = Query(min_length=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentCheckResponse:
    """Check the current user's stored document extractions for a scheme."""
    scheme = get_scheme_repository().get(scheme_id)
    if scheme is None:
        raise HTTPException(status_code=404, detail={"code": "scheme_not_found"})
    documents = list(
        db.scalars(select(Document).where(Document.user_id == user.id)).all()
    )
    return check_documents(scheme, documents, language=i18n.normalize_language(user.language))
