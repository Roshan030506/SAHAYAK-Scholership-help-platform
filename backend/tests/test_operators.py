"""Unit tests for every supported deterministic rule operator."""

from __future__ import annotations

import pytest

from app.services.eligibility import evaluate_rule
from tests.conftest import make_rule


@pytest.mark.parametrize(
    ("field", "operator", "value", "profile", "expected"),
    [
        ("category", "eq", "SC", {"category": "SC"}, "passed"),
        ("category", "eq", "SC", {"category": "OBC"}, "failed"),
        ("category", "eq", "sc", {"category": "SC"}, "passed"),
        ("state", "eq", "Maharashtra", {"state": "maharashtra"}, "passed"),
        ("disability_status", "eq", True, {"disability_status": True}, "passed"),
        ("disability_status", "eq", True, {"disability_status": False}, "failed"),
    ],
)
def test_eq_operator(field, operator, value, profile, expected):
    """Equality compares strings tolerantly and booleans strictly."""
    assert evaluate_rule(make_rule(field, operator, value), profile)[0] == expected


@pytest.mark.parametrize(
    ("profile", "expected"),
    [
        ({"category": "OBC"}, "passed"),
        ({"category": "sc"}, "passed"),
        ({"category": "General"}, "failed"),
    ],
)
def test_in_operator(profile, expected):
    """Membership is case-insensitive for text values."""
    rule = make_rule("category", "in", ["OBC", "SC", "EWS"])
    assert evaluate_rule(rule, profile)[0] == expected


@pytest.mark.parametrize(
    ("operator", "value", "actual", "expected"),
    [
        ("lt", 30, 29, "passed"),
        ("lt", 30, 30, "failed"),
        ("lte", 250000, 250000, "passed"),
        ("lte", 250000, 250001, "failed"),
        ("gt", 0, 1, "passed"),
        ("gt", 0, 0, "failed"),
        ("gte", 80, 80, "passed"),
        ("gte", 80, 79.99, "failed"),
    ],
)
def test_numeric_operators(operator, value, actual, expected):
    """Numeric comparisons use inclusive/exclusive boundaries correctly."""
    rule = make_rule("amount", operator, value)
    assert evaluate_rule(rule, {"amount": actual})[0] == expected


@pytest.mark.parametrize(
    ("actual", "expected"),
    [
        (17, "passed"),
        (25, "passed"),
        (21, "passed"),
        (16, "failed"),
        (26, "failed"),
    ],
)
def test_between_operator_inclusive(actual, expected):
    """``between`` includes both boundaries and excludes values outside."""
    rule = make_rule("age", "between", [17, 25])
    assert evaluate_rule(rule, {"age": actual})[0] == expected


def test_between_accepts_reversed_bounds():
    """A reversed range is normalized rather than producing nonsense."""
    rule = make_rule("age", "between", [25, 17])
    assert evaluate_rule(rule, {"age": 20})[0] == "passed"


def test_numeric_string_comparison():
    """Numeric strings from imported data compare like numbers."""
    rule = make_rule("last_exam_percentage", "gte", 80)
    assert evaluate_rule(rule, {"last_exam_percentage": "82.5"})[0] == "passed"


@pytest.mark.parametrize(
    ("field", "profile", "expected"),
    [
        ("institution_type", {"institution_type": "government"}, "passed"),
        ("bank_account_present", {"bank_account_present": False}, "passed"),
        ("institution_type", {}, "unknown"),
        ("institution_type", {"institution_type": None}, "unknown"),
        ("institution_type", {"institution_type": "   "}, "unknown"),
    ],
)
def test_exists_operator(field, profile, expected):
    """``exists`` treats false and zero as present but blanks as missing."""
    rule = make_rule(field, "exists")
    assert evaluate_rule(rule, profile)[0] == expected


def test_missing_field_is_unknown_for_numeric_rule():
    """Missing required values must be unknown, never silently failed."""
    rule = make_rule("annual_family_income", "lte", 250000)
    outcome, actual = evaluate_rule(rule, {})
    assert outcome == "unknown"
    assert actual is None


def test_invalid_numeric_type_is_unknown():
    """Non-numeric text is not coerced into a numeric comparison."""
    rule = make_rule("annual_family_income", "lte", 250000)
    assert evaluate_rule(rule, {"annual_family_income": "not-a-number"})[0] == "unknown"


def test_unknown_operator_is_rejected_by_schema():
    """Scheme JSON cannot contain an unsupported operator."""
    with pytest.raises(ValueError):
        make_rule("age", "approximately", 20)


def test_in_requires_non_empty_list():
    """Collection operators validate their operands at load time."""
    with pytest.raises(ValueError):
        make_rule("category", "in", [])


def test_between_requires_two_values():
    """``between`` cannot be defined with a scalar or one boundary."""
    with pytest.raises(ValueError):
        make_rule("age", "between", [17])
