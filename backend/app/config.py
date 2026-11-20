"""Application configuration loaded from environment variables and ``.env``."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent


class Settings(BaseSettings):
    """Typed runtime settings for the Sahayak backend.

    Values can be supplied through environment variables or a ``.env`` file at
    the repository root / backend directory. Defaults are safe for local demo
    use and never contain real credentials.
    """

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Sahayak"
    app_version: str = "1.0.0"
    environment: str = "development"
    log_level: str = "INFO"

    database_url: str = f"sqlite:///{(BASE_DIR / 'data' / 'sahayak.db').as_posix()}"
    secret_key: str = "sahayak-local-demo-secret-change-me"
    llm_provider: str = "mock"

    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-5"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173"
    )

    session_cookie_name: str = "sahayak_session"
    session_cookie_secure: bool = False
    session_max_age_seconds: int = 60 * 60 * 24 * 30

    data_dir: Path = BASE_DIR / "data"
    document_dir: Path = BASE_DIR / "data" / "documents"
    receipt_dir: Path = BASE_DIR / "data" / "receipts"
    screenshot_dir: Path = BASE_DIR / "data" / "screenshots"
    document_ttl_hours: int = 24

    backend_base_url: str = "http://localhost:8000"
    mock_portal_base_url: str = "http://localhost:8000/mock-portal"
    mock_portal_username: str = "demo"
    mock_portal_password: str = "demo123"
    playwright_headless: bool = True

    allowed_languages: tuple[str, ...] = ("en", "hi", "mr")

    @field_validator("llm_provider")
    @classmethod
    def _validate_provider(cls, value: str) -> str:
        """Normalize and validate the configured LLM provider name."""
        normalized = value.strip().lower()
        if normalized not in {"mock", "anthropic", "openai"}:
            raise ValueError("LLM_PROVIDER must be one of: mock, anthropic, openai")
        return normalized

    @property
    def cors_origin_list(self) -> list[str]:
        """Return CORS origins as a clean list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_sqlite(self) -> bool:
        """Whether the configured database is SQLite."""
        return self.database_url.startswith("sqlite")

    @property
    def schemes_dir(self) -> Path:
        """Directory containing editable scheme JSON files."""
        return BASE_DIR / "app" / "data" / "schemes"

    @property
    def portals_path(self) -> Path:
        """JSON file containing the official portal directory."""
        return BASE_DIR / "app" / "data" / "portals.json"

    @property
    def locales_dir(self) -> Path:
        """Directory containing UI/reason locale files."""
        return BASE_DIR / "app" / "locales"

    def ensure_directories(self) -> None:
        """Create all runtime storage directories if they do not exist."""
        for directory in (
            self.data_dir,
            self.document_dir,
            self.receipt_dir,
            self.screenshot_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached application settings instance."""
    return Settings()


settings = get_settings()
