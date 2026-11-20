"""Validation tests for the bundled trilingual scheme JSON files."""

from __future__ import annotations

from datetime import date

from app.models.scheme import RuleOperator
from app.schemas import ProfileFields
from app.services.schemes import get_scheme_repository

EXPECTED_IDS = {
    "post-matric-sc",
    "central-sector-scholarship",
    "nmms-scholarship",
    "maha-fee-reimbursement",
    "disability-education-scholarship",
    "aicte-pragati",
    "aicte-saksham",
    "maharashtra-ebc",
    "maharashtra-obc-post-matric",
    "post-matric-st",
    "sbi-asha",
    "hdfc-parivartan",
    "reliance-foundation-ug",
    "northsouth-foundation",
}


def test_repository_loads_expected_schemes(schemes):
    """The bundled PRD and verified scholarship schemes are all present."""
    assert len(schemes) == 14
    assert {scheme.id for scheme in schemes} == EXPECTED_IDS


def test_schemes_are_sorted_by_benefit_and_deadline(schemes):
    """Repository order is deterministic and useful for default listings."""
    keys = [(-scheme.benefit_amount_per_year, scheme.deadline, scheme.id) for scheme in schemes]
    assert keys == sorted(keys)


def test_all_schemes_have_complete_trilingual_content(schemes):
    """Names, authority and descriptions exist in en, hi and mr."""
    for scheme in schemes:
        for value in (scheme.name, scheme.short_name, scheme.authority, scheme.description):
            assert value.en.strip()
            assert value.hi.strip()
            assert value.mr.strip()


def test_all_schemes_have_source_and_apply_urls(schemes):
    """Every scheme is traceable to an official source or demo apply URL."""
    for scheme in schemes:
        assert scheme.source_url.startswith("http")
        assert scheme.apply_url.startswith(("http", "/mock-portal"))


def test_all_schemes_have_grievance_contacts(schemes):
    """Rights cards require a usable grievance channel."""
    for scheme in schemes:
        contact = scheme.grievance_contact
        assert contact.name and contact.phone and contact.email and contact.address


def test_all_schemes_have_rights(schemes):
    """Every scheme explains at least two citizen rights."""
    for scheme in schemes:
        assert len(scheme.rights) >= 2
        for right in scheme.rights:
            for value in (right.title, right.detail):
                assert value.en and value.hi and value.mr


def test_all_schemes_have_required_documents(schemes):
    """Scheme checklists are non-empty and trilingual."""
    for scheme in schemes:
        assert scheme.required_documents
        for document in scheme.required_documents:
            assert document.label.en and document.label.hi and document.label.mr


def test_rule_fields_are_real_profile_fields(schemes):
    """Rules cannot reference misspelled profile fields."""
    allowed = set(ProfileFields.model_fields)
    for scheme in schemes:
        for rule in scheme.rules:
            assert rule.field in allowed, (scheme.id, rule.field)


def test_rules_use_supported_operators(schemes):
    """Every scheme rule uses a member of the RuleOperator enum."""
    operators = {rule.operator for scheme in schemes for rule in scheme.rules}
    assert operators.issubset(set(RuleOperator))
    assert {RuleOperator.EQ, RuleOperator.IN, RuleOperator.LTE, RuleOperator.GTE, RuleOperator.BETWEEN, RuleOperator.EXISTS}.issubset(operators)


def test_deadlines_are_future_dates(schemes):
    """Bundled deadlines must not already be in the past."""
    today = date.today()
    for scheme in schemes:
        assert scheme.deadline > today, scheme.id


def test_repository_get_returns_none_for_unknown():
    """Unknown scheme ids are reported without exceptions."""
    repository = get_scheme_repository()
    assert repository.get("does-not-exist") is None


def test_repository_count_matches_list(schemes):
    """The repository count and listing agree."""
    repository = get_scheme_repository()
    assert repository.count() == len(schemes) == 14


def test_benefit_values_are_positive_and_varied(schemes):
    """Benefits are positive and varied enough for a useful visual ranking."""
    benefits = [scheme.benefit_amount_per_year for scheme in schemes]
    assert all(benefit > 0 for benefit in benefits)
    assert len(set(benefits)) >= 5
