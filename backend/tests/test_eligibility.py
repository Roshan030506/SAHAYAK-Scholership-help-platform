"""Eligibility engine tests, including boundary and missing-data cases."""

from __future__ import annotations

from datetime import date

from app.schemas import ProfileFields
from app.services.eligibility import evaluate_all, evaluate_scheme
from tests.conftest import make_scheme

FULL_PROFILE = ProfileFields(
    name="Riya Patil",
    age=19,
    gender="female",
    state="Maharashtra",
    district="Pune",
    category="SC",
    annual_family_income=200000,
    education_level="undergraduate",
    last_exam_percentage=82.4,
    course="B.Sc",
    institution_type="government",
    disability_status=False,
    bank_account_present=True,
)

SAMPLE_DOCUMENTS = [
    "income_certificate",
    "marksheet",
    "caste_certificate",
    "ration_card",
]


def get_scheme(scheme_id: str):
    """Fetch a real scheme from the repository by id."""
    from app.services.schemes import get_scheme_repository

    scheme = get_scheme_repository().get(scheme_id)
    assert scheme is not None
    return scheme


def test_post_matric_full_profile_is_eligible():
    """All rules pass for a matching post-matric profile."""
    result = evaluate_scheme(
        get_scheme("post-matric-sc"),
        FULL_PROFILE,
        available_document_types=SAMPLE_DOCUMENTS,
    )
    assert result.status == "eligible"
    assert result.failed_count == 0
    assert result.unknown_count == 0
    assert result.passed_count == result.total_rules == 4


def test_post_matric_boundary_income_is_eligible():
    """Income exactly on the cap must pass an ``lte`` rule."""
    profile = FULL_PROFILE.model_copy(update={"annual_family_income": 250000})
    result = evaluate_scheme(get_scheme("post-matric-sc"), profile)
    assert result.status == "eligible"


def test_post_matric_income_just_above_cap_fails():
    """One rupee above the cap must fail."""
    profile = FULL_PROFILE.model_copy(update={"annual_family_income": 250001})
    result = evaluate_scheme(get_scheme("post-matric-sc"), profile)
    assert result.status == "not_eligible"
    assert any(rule.field == "annual_family_income" for rule in result.failed_rules)


def test_missing_income_produces_likely():
    """A missing income is unknown, so the result is likely, not ineligible."""
    profile = FULL_PROFILE.model_copy(update={"annual_family_income": None})
    result = evaluate_scheme(get_scheme("post-matric-sc"), profile)
    assert result.status == "likely"
    assert "annual_family_income" in result.missing_fields
    assert result.unknown_count == 1


def test_missing_category_produces_likely():
    """A missing category is also treated as unknown."""
    profile = FULL_PROFILE.model_copy(update={"category": None})
    result = evaluate_scheme(get_scheme("post-matric-sc"), profile)
    assert result.status == "likely"
    assert "category" in result.missing_fields


def test_failed_rule_beats_missing_field():
    """A hard failure yields not_eligible even when another field is missing."""
    profile = ProfileFields(annual_family_income=999999)
    result = evaluate_scheme(get_scheme("central-sector-scholarship"), profile)
    assert result.status == "not_eligible"
    assert result.failed_count >= 1
    assert result.unknown_count >= 1


def test_central_sector_percentage_boundary_passes():
    """Exactly 80% meets the Central Sector cutoff."""
    result = evaluate_scheme(
        get_scheme("central-sector-scholarship"),
        FULL_PROFILE.model_copy(update={"last_exam_percentage": 80.0}),
    )
    assert result.status == "eligible"


def test_central_sector_below_percentage_boundary_fails():
    """79.99% does not meet the Central Sector cutoff."""
    result = evaluate_scheme(
        get_scheme("central-sector-scholarship"),
        FULL_PROFILE.model_copy(update={"last_exam_percentage": 79.99}),
    )
    assert result.status == "not_eligible"


def test_nmms_profile_is_eligible():
    """A class 8 government-school profile passes NMMS rules."""
    profile = ProfileFields(
        education_level="class_8",
        annual_family_income=300000,
        institution_type="government",
        last_exam_percentage=60,
    )
    result = evaluate_scheme(get_scheme("nmms-scholarship"), profile)
    assert result.status == "eligible"


def test_nmms_rejects_undergraduate_profile():
    """An undergraduate profile is not eligible for the class 8 scheme."""
    result = evaluate_scheme(get_scheme("nmms-scholarship"), FULL_PROFILE)
    assert result.status == "not_eligible"
    assert any(rule.field == "education_level" for rule in result.failed_rules)


def test_maharashtra_fee_scheme_eligible():
    """A domiciled Maharashtra student passes the fee-reimbursement rules."""
    result = evaluate_scheme(
        get_scheme("maha-fee-reimbursement"),
        FULL_PROFILE,
        available_document_types=SAMPLE_DOCUMENTS,
    )
    assert result.status == "eligible"


def test_maharashtra_fee_scheme_requires_state_domicile():
    """A student from another state fails the domicile rule."""
    result = evaluate_scheme(
        get_scheme("maha-fee-reimbursement"),
        FULL_PROFILE.model_copy(update={"state": "Gujarat"}),
    )
    assert result.status == "not_eligible"
    assert any(rule.field == "state" for rule in result.failed_rules)


def test_maharashtra_fee_scheme_requires_bank_account():
    """The bank-account rule fails cleanly when the profile says no."""
    result = evaluate_scheme(
        get_scheme("maha-fee-reimbursement"),
        FULL_PROFILE.model_copy(update={"bank_account_present": False}),
    )
    assert result.status == "not_eligible"
    assert any(rule.field == "bank_account_present" for rule in result.failed_rules)


def test_disability_scholarship_eligible():
    """A disabled student under 30 with low income is eligible."""
    profile = FULL_PROFILE.model_copy(
        update={"disability_status": True, "annual_family_income": 500000, "age": 25}
    )
    result = evaluate_scheme(get_scheme("disability-education-scholarship"), profile)
    assert result.status == "eligible"


def test_disability_scholarship_age_boundary_fails():
    """The strict ``lt 30`` rule rejects an applicant aged exactly 30."""
    profile = FULL_PROFILE.model_copy(
        update={"disability_status": True, "annual_family_income": 500000, "age": 30}
    )
    result = evaluate_scheme(get_scheme("disability-education-scholarship"), profile)
    assert result.status == "not_eligible"


def test_full_profile_evaluates_whole_catalogue():
    """The demo profile sees six eligible schemes and clear rejections."""
    scheme_ids = (
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
    )
    results = evaluate_all(
        [get_scheme(scheme_id) for scheme_id in scheme_ids],
        FULL_PROFILE,
        available_document_types=SAMPLE_DOCUMENTS,
    )
    statuses = {result.scheme_id: result.status for result in results}
    assert len(results) == 14
    assert statuses["post-matric-sc"] == "eligible"
    assert statuses["central-sector-scholarship"] == "eligible"
    assert statuses["maha-fee-reimbursement"] == "eligible"
    assert statuses["hdfc-parivartan"] == "eligible"
    assert statuses["reliance-foundation-ug"] == "eligible"
    assert statuses["sbi-asha"] == "eligible"
    assert statuses["nmms-scholarship"] == "not_eligible"
    assert statuses["disability-education-scholarship"] == "not_eligible"
    assert statuses["maharashtra-ebc"] == "not_eligible"
    assert statuses["maharashtra-obc-post-matric"] == "not_eligible"
    assert statuses["post-matric-st"] == "not_eligible"
    assert sum(1 for result in results if result.status == "eligible") == 6


def test_missing_documents_are_reported_without_changing_status():
    """Missing documents are a separate checklist, not an eligibility rule."""
    result = evaluate_scheme(
        get_scheme("post-matric-sc"),
        FULL_PROFILE,
        available_document_types=["income_certificate"],
    )
    assert result.status == "eligible"
    assert result.missing_documents == ["caste_certificate", "marksheet"]
    assert len(result.missing_document_labels) == 2


def test_uploaded_documents_remove_missing_flags():
    """All sample documents satisfy the required-document checklist."""
    result = evaluate_scheme(
        get_scheme("post-matric-sc"),
        FULL_PROFILE,
        available_document_types=SAMPLE_DOCUMENTS,
    )
    assert result.missing_documents == []
    assert result.missing_document_labels == []


def test_results_ranked_by_benefit_descending():
    """Ranking is by annual benefit, then deadline urgency."""
    results = evaluate_all(
        [
            get_scheme("post-matric-sc"),
            get_scheme("central-sector-scholarship"),
            get_scheme("nmms-scholarship"),
            get_scheme("maha-fee-reimbursement"),
            get_scheme("disability-education-scholarship"),
        ],
        FULL_PROFILE,
    )
    benefits = [result.benefit_amount_per_year for result in results]
    assert benefits == sorted(benefits, reverse=True)
    assert [result.rank for result in results] == [1, 2, 3, 4, 5]


def test_contains_any_matches_course_keywords():
    """Course keyword rules ignore case and punctuation variants."""
    from app.models.scheme import LocalizedText, SchemeRule
    from app.services.eligibility import evaluate_rule

    rule = SchemeRule(
        field="course",
        operator="contains_any",
        value=["engineering", "b.tech", "polytechnic"],
        label=LocalizedText(en="Technical course", hi="तकनीकी कोर्स", mr="तंत्रशिक्षण अभ्यासक्रम"),
    )
    assert evaluate_rule(rule, {"course": "B.Tech Computer Science"})[0] == "passed"
    assert evaluate_rule(rule, {"course": "Diploma in Polytechnic"})[0] == "passed"
    assert evaluate_rule(rule, {"course": "B.Sc Physics"})[0] == "failed"
    assert evaluate_rule(rule, {})[0] == "unknown"


def test_rank_tie_break_uses_earlier_deadline():
    """Equal benefits are ordered by the earlier deadline."""
    later = make_scheme(scheme_id="later-deadline", benefit=1000, deadline="2026-12-31")
    earlier = make_scheme(scheme_id="earlier-deadline", benefit=1000, deadline="2026-12-01")
    results = evaluate_all([later, earlier], ProfileFields(category="SC"))
    assert [result.scheme_id for result in results] == ["earlier-deadline", "later-deadline"]
    assert results[0].rank == 1


def test_empty_profile_produces_likely_everywhere():
    """An empty profile cannot fail rules; everything is uncertain."""
    for scheme_id in (
        "post-matric-sc",
        "central-sector-scholarship",
        "nmms-scholarship",
        "maha-fee-reimbursement",
        "disability-education-scholarship",
    ):
        result = evaluate_scheme(get_scheme(scheme_id), ProfileFields())
        assert result.status == "likely", scheme_id
        assert result.failed_count == 0
        assert result.unknown_count == result.total_rules


def test_hindi_status_and_summary_are_localized():
    """Reason wrappers and summaries use the requested locale."""
    result = evaluate_scheme(get_scheme("post-matric-sc"), FULL_PROFILE, language="hi")
    assert result.status == "eligible"
    assert "पात्र" in result.status_reason
    assert "शर्तें" in result.status_summary


def test_marathi_failed_rule_reason_is_localized():
    """Failed rule labels and wrappers appear in Marathi."""
    profile = FULL_PROFILE.model_copy(update={"education_level": "class_10"})
    result = evaluate_scheme(get_scheme("post-matric-sc"), profile, language="mr")
    assert result.status == "not_eligible"
    assert result.failed_rules
    assert "पूर्ण झाले नाही" in result.failed_rules[0].reason


def test_reason_keys_are_stable_and_unique():
    """Every rule carries a deterministic key for translation and UI tests."""
    result = evaluate_scheme(get_scheme("post-matric-sc"), ProfileFields())
    keys = [
        rule.reason_key
        for rule in result.passed_rules + result.failed_rules + result.unknown_rules
    ]
    assert len(keys) == len(set(keys)) == result.total_rules
    assert all(key.startswith("post-matric-sc.rule.") for key in keys)


def test_required_document_labels_are_localized():
    """Required document labels use the Marathi locale."""
    result = evaluate_scheme(get_scheme("post-matric-sc"), FULL_PROFILE, language="mr")
    labels = [document.label for document in result.required_documents]
    assert "जातीचा दाखला" in labels


def test_missing_field_labels_are_localized():
    """Missing field prompts are translated for the user."""
    profile = FULL_PROFILE.model_copy(update={"annual_family_income": None})
    result = evaluate_scheme(get_scheme("post-matric-sc"), profile, language="mr")
    assert "वार्षिक कौटुंबिक उत्पन्न" in result.missing_field_labels


def test_unknown_rules_expose_actual_none_and_label():
    """Unknown rules keep the field identity and a null actual value."""
    profile = ProfileFields(category="SC")
    result = evaluate_scheme(get_scheme("post-matric-sc"), profile)
    unknown_fields = {rule.field for rule in result.unknown_rules}
    assert "annual_family_income" in unknown_fields
    assert all(rule.actual is None for rule in result.unknown_rules)


def test_scheme_description_deadlines_are_future(schemes):
    """The bundled demo deadlines must still be actionable."""
    for scheme in schemes:
        assert scheme.deadline >= date(2026, 11, 1), scheme.id
