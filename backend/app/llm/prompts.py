"""Shared prompts for optional real LLM providers."""

from __future__ import annotations

import json

from app.models.scheme import Scheme

PROFILE_SCHEMA_HINT = """
Return a JSON object with this exact shape:
{
  "updates": {
    "name": string|null,
    "age": integer|null,
    "gender": "female"|"male"|"other"|null,
    "state": string|null,
    "district": string|null,
    "category": "General"|"OBC"|"SC"|"ST"|"EWS"|null,
    "annual_family_income": integer rupees|null,
    "education_level": "class_8"|"class_9"|"class_10"|"class_11"|"class_12"|"undergraduate"|"postgraduate"|"diploma"|"iti"|null,
    "last_exam_percentage": number 0-100|null,
    "course": string|null,
    "institution_type": "government"|"government_aided"|"private"|"municipal"|"other"|null,
    "disability_status": boolean|null,
    "bank_account_present": boolean|null
  },
  "confidence": {"field_name": number between 0 and 1},
  "summary": "one short sentence in the requested language",
  "follow_up_questions": ["up to 3 questions in the requested language"]
}
Only include fields that are explicitly stated or can be directly and safely inferred.
Never invent a name, income, category or disability status.
""".strip()

DOCUMENT_SCHEMA_HINT = """
Return a JSON object with this exact shape:
{
  "document_type": "income_certificate"|"marksheet"|"caste_certificate"|"ration_card"|"disability_certificate"|"unknown",
  "fields": {"field_name": value},
  "confidence": {"field_name": number between 0 and 1},
  "raw_text": "short relevant text or null",
  "warnings": ["short warnings"]
}
Never invent unreadable values. Use a low confidence score when text is unclear.
Do not return Aadhaar numbers or full bank account numbers; mask them instead.
""".strip()


def system_instruction(language: str) -> str:
    """Return a compact system instruction for citizen-facing answers."""
    language_name = {"en": "English", "hi": "Hindi", "mr": "Marathi"}.get(language, "English")
    return (
        "You are Sahayak, a careful civic assistant for Indian student scholarships. "
        f"Answer in {language_name}. Be concise, respectful and plain-language. "
        "Eligibility is decided by a deterministic rules engine, never by you; explain, "
        "do not decide. Never request or repeat Aadhaar numbers, OTPs, passwords or full "
        "bank account numbers. Do not give legal or financial guarantees."
    )


def profile_prompt(text: str, language: str) -> str:
    """Build the profile extraction prompt."""
    return (
        f"Extract a citizen profile from the text below. Language: {language}.\n"
        f"{PROFILE_SCHEMA_HINT}\n\nText:\n{text}"
    )


def document_prompt(expected_type: str | None, language: str) -> str:
    """Build the document extraction prompt."""
    return (
        "Extract fields from this Indian scholarship document image. "
        f"Language for warnings: {language}. "
        f"Expected document type: {expected_type or 'detect automatically'}.\n"
        f"{DOCUMENT_SCHEMA_HINT}"
    )


def explain_prompt(scheme: Scheme, profile: dict, language: str) -> str:
    """Build a grounded scheme explanation prompt."""
    compact_scheme = scheme.model_dump(mode="json")
    return (
        f"Explain this scholarship scheme in {language}, in 120 words or fewer. "
        "State the benefit, deadline, key conditions, required documents and the source. "
        "Do not state a final eligibility verdict. "
        f"Scheme JSON:\n{json.dumps(compact_scheme, ensure_ascii=False)}\n\n"
        f"Citizen profile (may be partial):\n{json.dumps(profile, ensure_ascii=False)}"
    )


def chat_prompt(question: str, context: str, language: str) -> str:
    """Build a strictly grounded Q&A prompt."""
    return (
        f"Answer in {language} using ONLY the retrieved scheme context below. "
        "Cite every scheme you mention as [scheme:<id>]. "
        "If the context does not contain the answer, say that the information is not "
        "in the available scheme data. Refuse questions outside these scholarship schemes.\n\n"
        f"Retrieved context:\n{context}\n\nQuestion: {question}"
    )


def error_prompt(error_text: str, field: str | None, current_value: object, language: str) -> str:
    """Build the portal-error interpretation prompt."""
    return (
        "A government scholarship portal showed the validation error below. "
        f"Reply in {language}. Return a JSON object with keys: "
        '"action" (one of "correct", "retry", "needs_user_input"), '
        '"field" (portal field name or null), "corrected_value" (safe corrected value or null), '
        '"explanation" (one short sentence). '
        "Choose needs_user_input when the correction is not unambiguous. "
        "Never invent missing documents or personal identifiers.\n\n"
        f"Error text: {error_text}\nField: {field}\nCurrent value: {current_value}"
    )
