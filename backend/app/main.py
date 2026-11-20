"""FastAPI application entry point for Sahayak."""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.llm.factory import get_llm_provider
from app.routers import documents, match, me, portals, profile, schemes, session
from app.schemas import HealthResponse
from app.services.portals import PortalRepositoryError, get_portal_repository
from app.services.schemes import SchemeRepositoryError, get_scheme_repository

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize database, storage and scheme cache before serving traffic."""
    settings.ensure_directories()
    init_db()
    try:
        count = get_scheme_repository().reload()
        portal_count = get_portal_repository().reload()
    except (SchemeRepositoryError, PortalRepositoryError) as exc:
        logger.error("Data loading failed: %s", exc)
        raise
    provider = get_llm_provider()
    logger.info(
        "Sahayak started (provider=%s, schemes=%d, portals=%d, environment=%s)",
        provider.name,
        count,
        portal_count,
        settings.environment,
    )
    if settings.secret_key.startswith("sahayak-local-demo"):
        logger.warning("Using the default demo SECRET_KEY. Set SECRET_KEY before deployment.")
    yield
    logger.info("Sahayak shutting down")


app = FastAPI(
    title="Sahayak API",
    description="Voice-first scholarship eligibility and application copilot.",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

for router in (
    session.router,
    profile.router,
    schemes.router,
    portals.router,
    match.router,
    documents.router,
    me.router,
):
    app.include_router(router, prefix="/api")


@app.middleware("http")
async def request_logging_and_headers(request: Request, call_next):
    """Log request timing and add basic browser security headers."""
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled error while processing %s %s", request.method, request.url.path)
        raise
    duration_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "%s %s -> %s (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


@app.exception_handler(SchemeRepositoryError)
async def scheme_error_handler(_request: Request, exc: SchemeRepositoryError) -> JSONResponse:
    """Return a clear error if scheme data is unavailable at runtime."""
    logger.error("Scheme repository error: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"error": {"code": "schemes_unavailable", "message": "Scheme data is unavailable."}},
    )


@app.exception_handler(PortalRepositoryError)
async def portal_error_handler(_request: Request, exc: PortalRepositoryError) -> JSONResponse:
    """Return a clear error if the portal directory cannot be loaded."""
    logger.error("Portal repository error: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"error": {"code": "portals_unavailable", "message": "Portal data is unavailable."}},
    )


@app.get("/", tags=["meta"])
def root() -> dict[str, object]:
    """Return service metadata for humans and health checks."""
    return {
        "name": "Sahayak API",
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/health",
        "demo_mode": settings.llm_provider == "mock",
    }


@app.get("/api/health", response_model=HealthResponse, tags=["meta"])
@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health() -> HealthResponse:
    """Report service health, active provider and loaded scheme count."""
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        llm_provider=settings.llm_provider,
        schemes_loaded=get_scheme_repository().count(),
    )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
