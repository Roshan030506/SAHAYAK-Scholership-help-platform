"""Deterministic eligibility rules engine.

The LLM is never consulted here: eligibility is decided only by the rules in
each scheme JSON file. Unknown or missing inputs produce a ``likely`` result
instead of guessing, while any failed rule produces ``not_eligible``.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping
from typing import Any

from pydantic import BaseModel

from app.models.scheme import RuleOperator, Scheme, SchemeRule
from app.schemas import EligibilityResult, RequiredDocumentResult, RuleResult
from app.services import i18n

logger = logging.getLogger(__name__)

_MISSING = object()

ProfileFieldsLike = BaseModel | Mapping[str, Any]


def _as_mapping(fields: ProfileFieldsLike) -> dict[str, Any]:
    """Convert a Pydantic profile or plain mapping to a dictionary."""
    if isinstance(fields, BaseModel):
        return fields.model_dump(exclude_none=True)
    return dict(fields)


def _is_missing(value: Any) -> bool:
    """Return whether a profile value should be treated as unknown."""
    if value is _MISSING or value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, tuple, dict, set)) and len(value) == 0:
        return True
    return False


def _get_value(fields: Mapping[str, Any], field: str) -> Any:
    """Read a field value or the missing sentinel."""
    value = fields.get(field, _MISSING)
    return _MISSING if _is_missing(value) else value


def _normalize_text(value: Any) -> str:
    """Case-fold and collapse a value for tolerant string comparison."""
    return " ".join(str(value).strip().casefold().split())


def _to_number(value: Any) -> float | None:
    """Convert a profile value to a number, rejecting booleans."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace("₹", "").replace(",", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _equal(actual: Any, expected: Any) -> bool:
    """Compare scalars with tolerant handling of strings and numbers."""
    if isinstance(expected, bool) or isinstance(actual, bool):
        if isinstance(actual, str):
            actual = actual.strip().lower() in {"true", "yes", "1"}
        if isinstance(expected, str):
            expected = expected.strip().lower() in {"true", "yes", "1"}
        return bool(actual) is bool(expected)
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        actual_number = _to_number(actual)
        return actual_number is not None and actual_number == float(expected)
    if isinstance(actual, (int, float)) and not isinstance(actual, bool) and isinstance(expected, str):
        expected_number = _to_number(expected)
        if expected_number is not None:
            return float(actual) == expected_number
    return _normalize_text(actual) == _normalize_text(expected)


def _contains(actual: Any, expected_values: Iterable[Any]) -> bool:
    """Check membership using the same tolerant equality as ``eq``."""
    return any(_equal(actual, candidate) for candidate in expected_values)


def evaluate_rule(rule: SchemeRule, fields: Mapping[str, Any]) -> tuple[str, Any]:
    """Evaluate one rule against profile fields.

    Returns a tuple of ``(outcome, actual_value)`` where outcome is one of
    ``passed``, ``failed`` or ``unknown``. ``unknown`` means the field is
    missing or the value type cannot be compared safely.
    """
    actual = _get_value(fields, rule.field)
    if actual is _MISSING:
        return "unknown", None
    operator = rule.operator

    if operator == RuleOperator.EXISTS:
        return "passed", actual

    if operator == RuleOperator.EQ:
        return ("passed" if _equal(actual, rule.value) else "failed"), actual

    if operator == RuleOperator.IN:
        expected = rule.value if isinstance(rule.value, list) else []
        return ("passed" if _contains(actual, expected) else "failed"), actual

    if operator == RuleOperator.CONTAINS_ANY:
        expected = rule.value if isinstance(rule.value, list) else []
        if not isinstance(actual, str):
            logger.warning("Non-text contains_any comparison for field %s", rule.field)
            return "unknown", actual
        haystack = _normalize_text(actual)
        matched = any(
            _normalize_text(candidate) in haystack
            for candidate in expected
            if str(candidate).strip()
        )
        return ("passed" if matched else "failed"), actual

    if operator in {RuleOperator.LT, RuleOperator.LTE, RuleOperator.GT, RuleOperator.GTE}:
        actual_number = _to_number(actual)
        expected_number = _to_number(rule.value)
        if actual_number is None or expected_number is None:
            logger.warning("Non-numeric comparison for field %s; treating as unknown", rule.field)
            return "unknown", actual
        comparisons = {
            RuleOperator.LT: actual_number < expected_number,
            RuleOperator.LTE: actual_number <= expected_number,
            RuleOperator.GT: actual_number > expected_number,
            RuleOperator.GTE: actual_number >= expected_number,
        }
        return ("passed" if comparisons[operator] else "failed"), actual

    if operator == RuleOperator.BETWEEN:
        actual_number = _to_number(actual)
        bounds = rule.value if isinstance(rule.value, list) else []
        low = _to_number(bounds[0]) if len(bounds) == 2 else None
        high = _to_number(bounds[1]) if len(bounds) == 2 else None
        if actual_number is None or low is None or high is None:
            logger.warning("Invalid between comparison for field %s", rule.field)
            return "unknown", actual
        low, high = min(low, high), max(low, high)
        return ("passed" if low <= actual_number <= high else "failed"), actual

    logger.error("Unsupported rule operator '%s' for field %s", operator, rule.field)
    return "unknown", actual


def _rule_result(
    scheme: Scheme,
    rule: SchemeRule,
    index: int,
    outcome: str,
    actual: Any,
    language: str,
) -> RuleResult:
    """Build a localized rule result with a stable reason key."""
    label = i18n.localized(rule.label, language)
    reason = i18n.reason_text(outcome, label, language)
    return RuleResult(
        field=rule.field,
        operator=rule.operator,
        expected=rule.value,
        actual=actual,
        outcome=outcome,  # type: ignore[arg-type]
        reason_key=f"{scheme.id}.rule.{index}.{outcome}",
        reason=reason,
    )


def evaluate_scheme(
    scheme: Scheme,
    fields: ProfileFieldsLike,
    language: str = "en",
    available_document_types: Iterable[str] | None = None,
) -> EligibilityResult:
    """Evaluate one scheme and explain every rule outcome.

    Missing profile fields never produce ``not_eligible`` by themselves; they
    reduce confidence to ``likely`` so the UI can ask for more information.
    """
    language = i18n.normalize_language(language)
    field_values = _as_mapping(fields)
    passed: list[RuleResult] = []
    failed: list[RuleResult] = []
    unknown: list[RuleResult] = []

    for index, rule in enumerate(scheme.rules):
        outcome, actual = evaluate_rule(rule, field_values)
        result = _rule_result(scheme, rule, index, outcome, actual, language)
        {"passed": passed, "failed": failed, "unknown": unknown}[outcome].append(result)

    if failed:
        status = "not_eligible"
    elif unknown:
        status = "likely"
    else:
        status = "eligible"

    missing_fields = list(dict.fromkeys(rule.field for rule in unknown))
    missing_field_labels = [i18n.field_label(field, language) for field in missing_fields]

    available = set(available_document_types or ())
    missing_documents = [
        document.type
        for document in scheme.required_documents
        if document.type not in available
    ]
    missing_document_labels = [
        i18n.localized(document.label, language)
        for document in scheme.required_documents
        if document.type not in available
    ]
    required_documents = [
        RequiredDocumentResult(
            type=document.type,
            label=i18n.localized(document.label, language),
        )
        for document in scheme.required_documents
    ]

    counts = {
        "total": len(scheme.rules),
        "passed": len(passed),
        "failed": len(failed),
        "unknown": len(unknown),
    }
    return EligibilityResult(
        scheme_id=scheme.id,
        scheme_name=i18n.localized(scheme.name, language),
        short_name=i18n.localized(scheme.short_name, language),
        authority=i18n.localized(scheme.authority, language),
        benefit_amount_per_year=scheme.benefit_amount_per_year,
        deadline=scheme.deadline,
        status=status,
        status_reason=i18n.status_reason(status, language),
        status_summary=i18n.status_summary(status, language=language, **counts),
        passed_rules=passed,
        failed_rules=failed,
        unknown_rules=unknown,
        missing_fields=missing_fields,
        missing_field_labels=missing_field_labels,
        missing_documents=missing_documents,
        missing_document_labels=missing_document_labels,
        required_documents=required_documents,
        total_rules=counts["total"],
        passed_count=counts["passed"],
        failed_count=counts["failed"],
        unknown_count=counts["unknown"],
        source_url=scheme.source_url,
        apply_url=scheme.apply_url,
    )


def rank_results(results: list[EligibilityResult]) -> list[EligibilityResult]:
    """Rank results by annual benefit descending, then deadline urgency."""
    ordered = sorted(
        results,
        key=lambda result: (
            -result.benefit_amount_per_year,
            result.deadline,
            result.scheme_id,
        ),
    )
    for position, result in enumerate(ordered, start=1):
        result.rank = position
    return ordered


def evaluate_all(
    schemes: Iterable[Scheme],
    fields: ProfileFieldsLike,
    language: str = "en",
    available_document_types: Iterable[str] | None = None,
) -> list[EligibilityResult]:
    """Evaluate and rank every scheme for one profile."""
    results = [
        evaluate_scheme(
            scheme,
            fields,
            language=language,
            available_document_types=available_document_types,
        )
        for scheme in schemes
    ]
    return rank_results(results)
