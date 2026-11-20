"""Deterministic recommendation scoring built on eligibility and document state."""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from app.models.scheme import Scheme
from app.schemas import EligibilityResult
from app.services import i18n


def score_result(
    scheme: Scheme,
    result: EligibilityResult,
    fields: Mapping[str, object],
    available_document_types: Iterable[str],
    language: str = "en",
) -> EligibilityResult:
    """Attach a stable 0-100 score and short translated factor lists."""
    available = set(available_document_types)
    total_weight = sum(rule.weight for rule in scheme.rules)
    evaluated_by_key = {
        (evaluated.field, evaluated.operator): evaluated
        for evaluated in result.passed_rules + result.failed_rules + result.unknown_rules
    }
    passed_weight = sum(
        rule.weight
        for rule in scheme.rules
        if evaluated_by_key[(rule.field, rule.operator)].outcome == "passed"
    )
    eligibility_fit = (passed_weight / total_weight * 100) if total_weight else 0

    required_documents = {document.type for document in scheme.required_documents}
    readiness = (
        len(required_documents & available) / len(required_documents) * 100
        if required_documents
        else 100
    )
    score = round(eligibility_fit * 0.8 + readiness * 0.2)
    if any(
        rule.mandatory
        and evaluated_by_key[(rule.field, rule.operator)].outcome == "failed"
        for rule in scheme.rules
    ):
        score = min(score, 40)

    result.match_score = max(0, min(100, score))
    result.match_status = result.status
    result.score_factors_up = [
        evaluated.reason
        for evaluated in result.passed_rules[:3]
    ]
    result.score_factors_down = [
        evaluated.reason
        for evaluated in (result.failed_rules + result.unknown_rules)[:3]
    ]
    if result.missing_documents:
        result.score_factors_down.append(
            i18n.t("ui.missing_documents", language).format(count=len(result.missing_documents))
        )
    return result


def score_results(
    schemes: Iterable[Scheme],
    results: list[EligibilityResult],
    fields: Mapping[str, object],
    available_document_types: Iterable[str],
    language: str = "en",
) -> list[EligibilityResult]:
    """Score results in repository order without randomness or side effects."""
    by_id = {scheme.id: scheme for scheme in schemes}
    available = list(available_document_types)
    return [
        score_result(by_id[result.scheme_id], result, fields, available, language)
        for result in results
    ]
