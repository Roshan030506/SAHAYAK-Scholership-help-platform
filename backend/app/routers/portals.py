"""Official scholarship portal directory endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.schemas import PortalListResponse
from app.services.portals import get_portal_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portals", tags=["portals"])


@router.get("", response_model=PortalListResponse)
def list_portals() -> PortalListResponse:
    """List official central, state and CSR scholarship portals."""
    portals = get_portal_repository().all_dicts()
    logger.debug("Listing %d scholarship portals", len(portals))
    return PortalListResponse(portals=portals, count=len(portals))
