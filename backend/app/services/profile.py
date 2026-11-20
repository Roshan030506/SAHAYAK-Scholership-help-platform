"""Profile merge, validation and completeness helpers."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models import Profile, User, utcnow
from app.schemas import ProfileFields, ProfileResponse

logger = logging.getLogger(__name__)

PROFILE_FIELD_NAMES: tuple[str, ...] = tuple(ProfileFields.model_fields.keys())

# Fields that make a profile useful for matching. All FR-1 fields are counted.
_CORE_FIELDS: tuple[str, ...] = PROFILE_FIELD_NAMES


def profile_fields_from_raw(raw: dict[str, Any] | None) -> ProfileFields:
    """Validate a stored JSON dictionary into the typed profile model."""
    if not raw:
        return ProfileFields()
    # Ignore unknown legacy keys instead of failing the whole profile.
    filtered = {key: value for key, value in raw.items() if key in PROFILE_FIELD_NAMES}
    return ProfileFields.model_validate(filtered)


def merge_profile_fields(
    existing: ProfileFields | dict[str, Any] | None,
    updates: dict[str, Any],
) -> ProfileFields:
    """Merge validated updates into an existing profile.

    Only known profile keys are accepted. An explicit ``None`` clears a field,
    while an omitted key leaves the previous value unchanged.
    """
    base = (
        existing.model_dump() if isinstance(existing, ProfileFields) else dict(existing or {})
    )
    filtered = {key: value for key, value in updates.items() if key in PROFILE_FIELD_NAMES}
    base.update(filtered)
    return ProfileFields.model_validate(base)


def missing_core_fields(fields: ProfileFields | dict[str, Any]) -> list[str]:
    """Return FR-1 fields that still have no value."""
    data = fields.model_dump() if isinstance(fields, ProfileFields) else dict(fields)
    return [field for field in _CORE_FIELDS if data.get(field) is None]


def sanitize_updates(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Filter LLM output to known, individually valid profile values.

    A malformed optional field is skipped rather than rejecting an otherwise
    useful extraction.
    """
    if not raw:
        return {}
    cleaned: dict[str, Any] = {}
    for key, value in raw.items():
        if key not in PROFILE_FIELD_NAMES or value is None:
            continue
        try:
            partial = ProfileFields.model_validate({key: value})
        except ValidationError:
            logger.warning("Ignoring invalid extracted profile value for field %s", key)
            continue
        field_value = getattr(partial, key)
        if field_value is not None:
            cleaned[key] = field_value
    return cleaned



def completeness(fields: ProfileFields | dict[str, Any]) -> float:
    """Return the fraction of FR-1 fields that are populated."""
    data = fields.model_dump() if isinstance(fields, ProfileFields) else dict(fields)
    if not _CORE_FIELDS:
        return 0.0
    present = sum(1 for field in _CORE_FIELDS if data.get(field) is not None)
    return round(present / len(_CORE_FIELDS), 3)


def get_profile(db: Session, user_id: str) -> Profile | None:
    """Fetch the stored profile row for a user."""
    return db.get(Profile, user_id)


def save_profile(
    db: Session,
    user: User,
    updates: dict[str, Any],
    language: str | None = None,
) -> ProfileResponse:
    """Merge updates into the stored profile, persist them and return a DTO."""
    row = db.get(Profile, user.id)
    existing = profile_fields_from_raw(row.fields if row else None)
    merged = merge_profile_fields(existing, updates)

    if row is None:
        row = Profile(user_id=user.id, fields=merged.as_clean_dict())
        db.add(row)
    else:
        row.fields = merged.as_clean_dict()
        row.updated_at = utcnow()

    if language:
        user.language = language

    db.commit()
    db.refresh(row)
    db.refresh(user)
    return build_profile_response(user, row)


def build_profile_response(user: User, row: Profile | None) -> ProfileResponse:
    """Build the API response for a stored profile row."""
    fields = profile_fields_from_raw(row.fields if row else None)
    return ProfileResponse(
        user_id=user.id,
        language=user.language,  # type: ignore[arg-type]
        fields=fields,
        updated_at=row.updated_at if row else None,
        completeness=completeness(fields),
        missing_fields=missing_core_fields(fields),
    )
