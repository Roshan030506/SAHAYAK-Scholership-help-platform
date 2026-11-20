"""Deterministic mock LLM provider for fully offline demos.

The mock provider is intentionally more than a canned-response stub: it uses
transparent heuristics so typed or spoken English/Hindi/Marathi profile text
produces realistic structured updates. Document extraction returns pre-baked
values that match the bundled synthetic sample documents.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

from app.llm.base import (
    DocumentExtraction,
    ErrorInterpretation,
    LLMProvider,
    ProfileExtraction,
)
from app.models.scheme import Scheme
from app.services import i18n

_DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

_WORD_NUMBERS: dict[str, int] = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "twelve": 12,
    "एक": 1,
    "दो": 2,
    "दोन": 2,
    "तीन": 3,
    "चार": 4,
    "पांच": 5,
    "पाँच": 5,
    "पाच": 5,
    "छह": 6,
    "छः": 6,
    "सहा": 6,
    "सात": 7,
    "आठ": 8,
    "नौ": 9,
    "नऊ": 9,
    "दस": 10,
    "दहा": 10,
}

_STATE_MARKERS: dict[str, str] = {
    "maharashtra": "Maharashtra",
    "महाराष्ट्र": "Maharashtra",
    "delhi": "Delhi",
    "दिल्ली": "Delhi",
    "karnataka": "Karnataka",
    "कर्नाटक": "Karnataka",
    "uttar pradesh": "Uttar Pradesh",
    "उत्तर प्रदेश": "Uttar Pradesh",
    "bihar": "Bihar",
    "बिहार": "Bihar",
    "gujarat": "Gujarat",
    "गुजरात": "Gujarat",
    "rajasthan": "Rajasthan",
    "राजस्थान": "Rajasthan",
    "madhya pradesh": "Madhya Pradesh",
    "मध्य प्रदेश": "Madhya Pradesh",
    "tamil nadu": "Tamil Nadu",
    "तमिलनाडु": "Tamil Nadu",
    "पश्चिम बंगाल": "West Bengal",
    "west bengal": "West Bengal",
    "kerala": "Kerala",
    "केरल": "Kerala",
    "केरळ": "Kerala",
    "punjab": "Punjab",
    "पंजाब": "Punjab",
    "haryana": "Haryana",
    "हरियाणा": "Haryana",
    "odisha": "Odisha",
    "ओडिशा": "Odisha",
    "telangana": "Telangana",
    "तेलंगाना": "Telangana",
    "andhra pradesh": "Andhra Pradesh",
    "आंध्र प्रदेश": "Andhra Pradesh",
    "assam": "Assam",
    "असम": "Assam",
}

_CITY_MARKERS: dict[str, tuple[str, str]] = {
    "pune": ("Pune", "Maharashtra"),
    "पुणे": ("Pune", "Maharashtra"),
    "पुण्या": ("Pune", "Maharashtra"),
    "mumbai": ("Mumbai", "Maharashtra"),
    "मुंबई": ("Mumbai", "Maharashtra"),
    "nagpur": ("Nagpur", "Maharashtra"),
    "नागपूर": ("Nagpur", "Maharashtra"),
    "नागपुर": ("Nagpur", "Maharashtra"),
    "nashik": ("Nashik", "Maharashtra"),
    "नाशिक": ("Nashik", "Maharashtra"),
    "thane": ("Thane", "Maharashtra"),
    "ठाणे": ("Thane", "Maharashtra"),
    "kolhapur": ("Kolhapur", "Maharashtra"),
    "कोल्हापूर": ("Kolhapur", "Maharashtra"),
    "aurangabad": ("Aurangabad", "Maharashtra"),
    "औरंगाबाद": ("Aurangabad", "Maharashtra"),
    "solapur": ("Solapur", "Maharashtra"),
    "सोलापूर": ("Solapur", "Maharashtra"),
    "amravati": ("Amravati", "Maharashtra"),
    "अमरावती": ("Amravati", "Maharashtra"),
    "bengaluru": ("Bengaluru", "Karnataka"),
    "bangalore": ("Bengaluru", "Karnataka"),
    "बेंगलुरु": ("Bengaluru", "Karnataka"),
    "बंगळुरू": ("Bengaluru", "Karnataka"),
}

_FOLLOW_UPS: dict[str, dict[str, str]] = {
    "en": {
        "age": "How old are you?",
        "category": "Which category do you belong to (General, OBC, SC, ST or EWS)?",
        "annual_family_income": "What is your family's annual income?",
        "education_level": "What are you currently studying?",
        "state": "Which state do you live in?",
    },
    "hi": {
        "age": "आपकी उम्र कितनी है?",
        "category": "आप किस श्रेणी से हैं (General, OBC, SC, ST या EWS)?",
        "annual_family_income": "आपके परिवार की वार्षिक आय कितनी है?",
        "education_level": "आप वर्तमान में क्या पढ़ रहे हैं?",
        "state": "आप किस राज्य में रहते हैं?",
    },
    "mr": {
        "age": "तुमचे वय किती आहे?",
        "category": "तुम्ही कोणत्या प्रवर्गातील आहात (General, OBC, SC, ST किंवा EWS)?",
        "annual_family_income": "तुमच्या कुटुंबाचे वार्षिक उत्पन्न किती आहे?",
        "education_level": "तुम्ही सध्या काय शिकत आहात?",
        "state": "तुम्ही कोणत्या राज्यात राहता?",
    },
}

_DOCUMENT_PRESETS: dict[str, tuple[dict[str, Any], dict[str, float]]] = {
    "income_certificate": (
        {
            "applicant_name": "Riya Patil",
            "annual_income": 200000,
            "certificate_number": "MH/INC/2026/001234",
            "issue_date": "2026-04-12",
            "issuing_authority": "Tehsildar Office, Pune",
            "valid_until": "2027-03-31",
        },
        {
            "applicant_name": 0.97,
            "annual_income": 0.95,
            "certificate_number": 0.93,
            "issue_date": 0.9,
            "issuing_authority": 0.88,
            "valid_until": 0.86,
        },
    ),
    "marksheet": (
        {
            "applicant_name": "Riya Patil",
            "board": "Maharashtra State Board of Secondary and Higher Secondary Education",
            "class": "12",
            "percentage": 82.4,
            "year_of_passing": 2026,
            "roll_number": "SAMPLE-26-4471",
        },
        {
            "applicant_name": 0.96,
            "board": 0.94,
            "class": 0.97,
            "percentage": 0.95,
            "year_of_passing": 0.92,
            "roll_number": 0.85,
        },
    ),
    "caste_certificate": (
        {
            "applicant_name": "Riya Patil",
            "category": "SC",
            "certificate_number": "MH/CASTE/2026/7788",
            "issue_date": "2026-03-18",
            "issuing_authority": "Sub-Divisional Officer, Pune",
        },
        {
            "applicant_name": 0.96,
            "category": 0.94,
            "certificate_number": 0.92,
            "issue_date": 0.89,
            "issuing_authority": 0.87,
        },
    ),
    "ration_card": (
        {
            "applicant_name": "Riya Patil",
            "ration_card_number": "SAMPLE-RC-4471",
            "family_members": 4,
            "address": "Kothrud, Pune, Maharashtra",
            "card_type": "Priority Household",
        },
        {
            "applicant_name": 0.94,
            "ration_card_number": 0.88,
            "family_members": 0.86,
            "address": 0.83,
            "card_type": 0.8,
        },
    ),
}

_REFUSALS = {
    "en": "I can only answer questions about the scholarship schemes in this demo. Try asking about eligibility, documents, benefits or deadlines.",
    "hi": "मैं इस डेमो में दी गई छात्रवृत्ति योजनाओं के बारे में ही उत्तर दे सकता हूँ। पात्रता, दस्तावेज़, लाभ या अंतिम तिथि के बारे में पूछें।",
    "mr": "मी या डेमोमधील शिष्यवृत्ती योजनांबद्दलच उत्तर देऊ शकतो. पात्रता, कागदपत्रे, लाभ किंवा अंतिम तारखेबद्दल विचारा.",
}


def _normalize_numbers(text: str) -> str:
    """Convert Devanagari digits to ASCII for parsing."""
    return text.translate(_DEVANAGARI_DIGITS)


def _parse_number(token: str) -> float | None:
    """Parse a numeric token or a small number word."""
    cleaned = token.strip().lower().replace(",", "").replace("₹", "")
    if cleaned in _WORD_NUMBERS:
        return float(_WORD_NUMBERS[cleaned])
    try:
        return float(cleaned)
    except ValueError:
        return None


def _extract_income(text: str) -> int | None:
    """Extract annual family income, including lakh/thousand units."""
    keyword = re.search(
        r"(?:annual\s+)?(?:family\s+)?(?:income|earning|salary|आय|उत्पन्न|कमाई)"
        r"[^0-9\n]{0,45}"
        r"([0-9]+(?:[.,][0-9]+)*|[a-z\u0900-\u097F]+)"
        r"\s*(lakhs?|lacs?|लाख|thousand|हजार|k)?",
        text,
        flags=re.IGNORECASE,
    )
    match = keyword
    if not match:
        match = re.search(
            r"([0-9]+(?:[.,][0-9]+)*|[a-z\u0900-\u097F]+)\s*(lakhs?|lacs?|लाख)",
            text,
            flags=re.IGNORECASE,
        )
    if not match:
        return None
    value = _parse_number(match.group(1))
    if value is None:
        return None
    unit = (match.group(2) or "").lower()
    if unit in {"lakh", "lakhs", "lac", "lacs", "लाख"}:
        value *= 100000
    elif unit in {"thousand", "हजार", "k"}:
        value *= 1000
    if value <= 0 or value > 1_000_000_000:
        return None
    return int(round(value))


def _extract_age(text: str) -> int | None:
    """Extract age only when a year/age marker makes it unambiguous."""
    patterns = [
        r"(?:age|aged)\s*(?:is|:)?\s*([0-9]{1,2})\b",
        r"([0-9]{1,2})\s*(?:years?|yrs?)\s*(?:old)?\b",
        r"([0-9]{1,2})\s*(?:वर्ष|साल|वर्षांची|वर्षांचा|वर्षांनी)\b",
        r"(?:वय|उम्र)\s*(?:है|आहे|:)?\s*([0-9]{1,2})\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            age = int(match.group(1))
            if 1 <= age <= 120:
                return age
    return None


def _extract_percentage(text: str) -> float | None:
    """Extract an exam percentage in English, Hindi or Marathi."""
    match = re.search(
        r"([0-9]{1,3}(?:\.[0-9]+)?)\s*(?:%|percent|percentage|टक्के|प्रतिशत)",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    value = float(match.group(1))
    return value if 0 <= value <= 100 else None


def _extract_name(original: str) -> str | None:
    """Extract a self-declared name from common English/Hindi/Marathi phrases."""
    match = re.search(
        r"(?:my\s+name\s+is|name\s+is|i\s+am\s+called|मेरा\s+नाम|मेरे\s+नाम|"
        r"माझे\s+नाव|माझं\s+नाव|नाम)\s+"
        r"([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F .'\-]{1,60})",
        original,
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    value = match.group(1)
    for stop in (" आहे", " आह", " from", " who", " and", ",", ".", "।"):
        value = value.split(stop, 1)[0]
    value = " ".join(value.split()).strip(" .'-")
    if not value:
        return None
    words = value.split()
    value = " ".join(words[:4])
    return value.title() if value.isascii() and value.islower() else value


def _extract_category(text: str) -> str | None:
    """Extract a normalized social category."""
    checks: list[tuple[str, str]] = [
        (r"scheduled\s+caste|\bsc\b|अनुसूचित\s+जाति|अनुसूचित\s+जाती", "SC"),
        (r"scheduled\s+tribe|\bst\b|अनुसूचित\s+जनजाति|अनुसूचित\s+जमाती", "ST"),
        (r"\bobc\b|other\s+backward|अन्य\s+पिछड़ा|इतर\s+मागास", "OBC"),
        (r"\bows\b|economically\s+weaker|आर्थिक\s+रूप\s+से\s+कमजोर|आर्थिकदृष्ट्या\s+कमजोर", "EWS"),
        (r"\bgeneral\b|unreserved|सामान्य", "General"),
    ]
    for pattern, category in checks:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return category
    return None


def _extract_education(text: str) -> str | None:
    """Extract a canonical education level from English/Hindi/Marathi text."""
    checks: list[tuple[str, str]] = [
        (r"postgraduate|post-graduate|masters|m\.?a\b|m\.?sc\b|m\.?com\b|स्नातकोत्तर|पदव्युत्तर", "postgraduate"),
        (
            r"undergraduate|graduation|college|degree|\bb\.?a\b|\bb\.?sc\b|\bb\.?com\b|"
            r"b\.?tech|स्नातक|पदवी",
            "undergraduate",
        ),
        (r"diploma|polytechnic|डिप्लोमा|पदविका", "diploma"),
        (r"\biti\b|आयटीआय", "iti"),
        (r"12th|class\s*12|std\s*12|12\s*वी|बारावी|बारहवीं", "class_12"),
        (r"11th|class\s*11|std\s*11|11\s*वी|अकरावी|ग्यारहवीं", "class_11"),
        (r"10th|class\s*10|std\s*10|10\s*वी|दहावी|दसवीं", "class_10"),
        (r"9th|class\s*9|std\s*9|9\s*वी|नववी|नौवीं", "class_9"),
        (r"8th|class\s*8|std\s*8|8\s*वी|आठवी|आठवीं", "class_8"),
    ]
    for pattern, level in checks:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return level
    return None


def _extract_gender(text: str) -> str | None:
    """Extract gender from common English/Hindi/Marathi markers."""
    if re.search(r"\bfemale\b|\bgirl\b|\bwoman\b|मुलगी|महिला|लड़की|स्त्री", text, re.IGNORECASE):
        return "female"
    if re.search(r"\bmale\b|\bboy\b|\bman\b|मुलगा|पुरुष|लड़का", text, re.IGNORECASE):
        return "male"
    if re.search(r"\bnon-?binary\b|\bother\b", text, re.IGNORECASE):
        return "other"
    return None


def _extract_location(text: str) -> tuple[str | None, str | None]:
    """Extract district and state from city/state markers."""
    district: str | None = None
    state: str | None = None
    for marker, (city, city_state) in sorted(
        _CITY_MARKERS.items(), key=lambda item: len(item[0]), reverse=True
    ):
        if marker in text:
            district = city
            state = city_state
            break
    for marker, state_name in sorted(
        _STATE_MARKERS.items(), key=lambda item: len(item[0]), reverse=True
    ):
        if marker in text:
            state = state or state_name
            break
    return district, state


def _extract_institution(text: str) -> str | None:
    """Extract institution type."""
    if re.search(r"government\s+aided|aided|अनुदानित", text, re.IGNORECASE):
        return "government_aided"
    if re.search(r"government|govt|सरकारी|शासकीय", text, re.IGNORECASE):
        return "government"
    if re.search(r"municipal|महानगरपालिका|नगरपालिका", text, re.IGNORECASE):
        return "municipal"
    if re.search(r"private|खाजगी|निजी", text, re.IGNORECASE):
        return "private"
    return None


def _extract_disability(text: str) -> bool | None:
    """Extract a self-declared disability status."""
    if re.search(r"not\s+disabled|no\s+disability|दिव्यांग\s+नहीं|दिव्यांग\s+नाही", text, re.IGNORECASE):
        return False
    if re.search(
        r"i\s+am\s+disabled|have\s+a\s+disability|disabled|divyang|"
        r"मैं\s+दिव्यांग|दिव्यांग\s+आहे|मला\s+दिव्यांगत्व",
        text,
        re.IGNORECASE,
    ):
        return True
    return None


def _extract_bank(text: str) -> bool | None:
    """Extract whether a bank account exists."""
    if not re.search(r"bank|बैंक|बँक", text, re.IGNORECASE):
        return None
    if re.search(r"(?:no|not|without|नहीं|नाही)\s+(?:a\s+)?(?:bank|बैंक|बँक)", text, re.IGNORECASE):
        return False
    if re.search(r"bank\s+account|बैंक\s+खाता|बँक\s+खाते", text, re.IGNORECASE):
        return True
    return None


def _extract_course(text: str) -> str | None:
    """Extract a common course label when explicitly mentioned."""
    patterns: list[tuple[str, str]] = [
        (r"\bb\.?tech\b|engineering|इंजिनियरिंग|इंजीनियरिंग", "B.Tech / Engineering"),
        (r"\bb\.?sc\b|science|विज्ञान|विज्ञान", "B.Sc / Science"),
        (r"\bb\.?com\b|commerce|वाणिज्य", "B.Com / Commerce"),
        (r"\bb\.?a\b|arts|कला", "BA / Arts"),
        (r"medical|medicine|mbbs|वैद्यकीय", "Medicine"),
    ]
    for pattern, label in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return label
    return None


class MockProvider(LLMProvider):
    """Offline provider with realistic heuristic extraction and explanations."""

    name = "mock"

    async def extract_profile(self, *, text: str, language: str = "en") -> ProfileExtraction:
        """Extract profile fields using deterministic multilingual heuristics."""
        language = i18n.normalize_language(language)
        normalized = _normalize_numbers(text).lower()
        original = _normalize_numbers(text)
        updates: dict[str, Any] = {}
        confidence: dict[str, float] = {}

        name = _extract_name(original)
        if name:
            updates["name"] = name
            confidence["name"] = 0.9

        age = _extract_age(normalized)
        if age is not None:
            updates["age"] = age
            confidence["age"] = 0.92

        gender = _extract_gender(normalized)
        if gender:
            updates["gender"] = gender
            confidence["gender"] = 0.93

        category = _extract_category(normalized)
        if category:
            updates["category"] = category
            confidence["category"] = 0.95

        income = _extract_income(normalized)
        if income is not None:
            updates["annual_family_income"] = income
            confidence["annual_family_income"] = 0.94

        education = _extract_education(normalized)
        if education:
            updates["education_level"] = education
            confidence["education_level"] = 0.92

        percentage = _extract_percentage(normalized)
        if percentage is not None:
            updates["last_exam_percentage"] = percentage
            confidence["last_exam_percentage"] = 0.95

        district, state = _extract_location(normalized)
        if district:
            updates["district"] = district
            confidence["district"] = 0.9
        if state:
            updates["state"] = state
            confidence["state"] = 0.94

        institution = _extract_institution(normalized)
        if institution:
            updates["institution_type"] = institution
            confidence["institution_type"] = 0.91

        disability = _extract_disability(normalized)
        if disability is not None:
            updates["disability_status"] = disability
            confidence["disability_status"] = 0.88

        bank = _extract_bank(normalized)
        if bank is not None:
            updates["bank_account_present"] = bank
            confidence["bank_account_present"] = 0.9

        course = _extract_course(normalized)
        if course:
            updates["course"] = course
            confidence["course"] = 0.84

        summary = i18n.t(
            "from_text.found" if updates else "from_text.no_fields",
            language,
            count=len(updates),
        )
        question_pool = _FOLLOW_UPS.get(language, _FOLLOW_UPS["en"])
        important = ["age", "category", "annual_family_income", "education_level", "state"]
        follow_ups = [question_pool[field] for field in important if field not in updates][:3]

        return ProfileExtraction(
            updates=updates,
            confidence=confidence,
            summary=summary,
            follow_up_questions=follow_ups,
        )

    async def extract_document(
        self,
        *,
        image_bytes: bytes,
        mime_type: str,
        filename: str,
        expected_type: str | None = None,
        language: str = "en",
    ) -> DocumentExtraction:
        """Return pre-baked extraction values for the bundled sample documents."""
        document_type = expected_type or self._detect_document_type(filename)
        preset = _DOCUMENT_PRESETS.get(document_type)
        if not preset:
            return DocumentExtraction(
                document_type=document_type,
                fields={},
                confidence={},
                warnings=["Mock mode could not match this document to a sample template."],
            )
        fields, confidence = preset
        return DocumentExtraction(
            document_type=document_type,
            fields=dict(fields),
            confidence=dict(confidence),
            raw_text=None,
            warnings=["Mock extraction: values are pre-baked for the synthetic sample documents."],
        )

    @staticmethod
    def _detect_document_type(filename: str) -> str:
        """Infer a document type from the filename in mock mode."""
        lowered = filename.lower()
        if "income" in lowered or "आय" in lowered or "उत्पन्न" in lowered:
            return "income_certificate"
        if "mark" in lowered or "result" in lowered or "अंक" in lowered or "गुण" in lowered:
            return "marksheet"
        if "caste" in lowered or "जाति" in lowered or "जाती" in lowered:
            return "caste_certificate"
        if "ration" in lowered or "राशन" in lowered or "रेशन" in lowered:
            return "ration_card"
        return "unknown"

    async def explain(
        self,
        *,
        scheme: Scheme,
        profile: Mapping[str, Any],
        language: str = "en",
    ) -> str:
        """Explain a scheme using only its localized JSON content."""
        language = i18n.normalize_language(language)
        name = i18n.localized(scheme.name, language)
        authority = i18n.localized(scheme.authority, language)
        documents = ", ".join(
            i18n.localized(document.label, language) for document in scheme.required_documents
        )
        conditions = "; ".join(i18n.localized(rule.label, language) for rule in scheme.rules)
        if language == "hi":
            return (
                f"{name} ({scheme.id}) {authority} द्वारा संचालित है। "
                f"इससे प्रति वर्ष ₹{scheme.benefit_amount_per_year:,} तक लाभ मिल सकता है। "
                f"मुख्य शर्तें: {conditions}। आवश्यक दस्तावेज़: {documents}। "
                f"अंतिम तिथि {scheme.deadline.isoformat()} है। स्रोत: {scheme.source_url}"
            )
        if language == "mr":
            return (
                f"{name} ({scheme.id}) ही योजना {authority} चालवते. "
                f"यातून दरवर्षी ₹{scheme.benefit_amount_per_year:,} पर्यंत लाभ मिळू शकतो. "
                f"मुख्य अटी: {conditions}. आवश्यक कागदपत्रे: {documents}. "
                f"अंतिम तारीख {scheme.deadline.isoformat()} आहे. स्रोत: {scheme.source_url}"
            )
        return (
            f"{name} ({scheme.id}) is offered by {authority}. "
            f"It can provide up to ₹{scheme.benefit_amount_per_year:,} per year. "
            f"Key conditions: {conditions}. Required documents: {documents}. "
            f"The deadline is {scheme.deadline.isoformat()}. Source: {scheme.source_url}"
        )

    async def chat(
        self,
        *,
        question: str,
        context: str,
        language: str = "en",
    ) -> str:
        """Answer using only retrieved scheme context and cite scheme ids."""
        language = i18n.normalize_language(language)
        citation_ids = list(
            dict.fromkeys(
                re.findall(r"(?:\[scheme:|scheme[_ ]?id[\"']?\s*[:=]\s*[\"']?)([a-z0-9-]+)", context)
            )
        )
        if not context.strip() or not citation_ids:
            return _REFUSALS[language]
        lowered_question = question.lower()
        if any(term in lowered_question for term in ("password", "otp", "aadhaar number", "पासवर्ड", "ओटीपी")):
            return _REFUSALS[language]

        snippet = " ".join(context.split())[:800]
        citations = ", ".join(f"[scheme:{scheme_id}]" for scheme_id in citation_ids)
        if language == "hi":
            return f"योजना की जानकारी के अनुसार: {snippet} स्रोत: {citations}"
        if language == "mr":
            return f"योजनेच्या माहितीनुसार: {snippet} स्रोत: {citations}"
        return f"According to the scheme data: {snippet} Sources: {citations}"

    async def interpret_error(
        self,
        *,
        error_text: str,
        field: str | None,
        current_value: Any,
        language: str = "en",
    ) -> ErrorInterpretation:
        """Map common portal validation errors to safe corrective actions."""
        language = i18n.normalize_language(language)
        lowered = error_text.lower()

        if "percentage" in lowered or "percent" in lowered:
            corrected = 100
            if isinstance(current_value, (int, float)):
                corrected = min(float(current_value), 100.0)
            explanation = {
                "en": "Percentage cannot exceed 100. The value was capped at 100.",
                "hi": "प्रतिशत 100 से अधिक नहीं हो सकता। मान 100 तक सीमित किया गया।",
                "mr": "टक्केवारी 100 पेक्षा जास्त असू शकत नाही. मूल्य 100 पर्यंत मर्यादित केले.",
            }[language]
            return ErrorInterpretation(
                action="correct",
                field="last_exam_percentage",
                corrected_value=corrected,
                explanation=explanation,
            )

        if "income" in lowered and any(word in lowered for word in ("format", "invalid", "numeric", "number")):
            cleaned: int | None = None
            if isinstance(current_value, str):
                digits = re.sub(r"[^0-9]", "", current_value)
                cleaned = int(digits) if digits else None
            elif isinstance(current_value, (int, float)):
                cleaned = int(current_value)
            explanation = {
                "en": "The income field needs a plain number of rupees. Formatting was removed.",
                "hi": "आय फ़ील्ड में रुपयों की सादी संख्या चाहिए। फ़ॉर्मैटिंग हटा दी गई।",
                "mr": "उत्पन्न क्षेत्रात रुपयांची साधी संख्या आवश्यक आहे. फॉर्मॅटिंग काढून टाकली.",
            }[language]
            return ErrorInterpretation(
                action="correct",
                field="annual_family_income",
                corrected_value=cleaned,
                explanation=explanation,
            )

        if any(word in lowered for word in ("file", "upload", "document", "required", "missing")):
            explanation = {
                "en": "This error needs a document or a value that the agent does not have. Please review the upload.",
                "hi": "इस त्रुटि के लिए दस्तावेज़ या ऐसा मान चाहिए जो एजेंट के पास नहीं है। कृपया अपलोड जाँचें।",
                "mr": "या त्रुटीसाठी कागदपत्र किंवा एजंटकडे नसलेले मूल्य आवश्यक आहे. कृपया अपलोड तपासा.",
            }[language]
            return ErrorInterpretation(
                action="needs_user_input",
                field=field,
                explanation=explanation,
            )

        if any(word in lowered for word in ("timeout", "timed out", "temporarily", "network")):
            explanation = {
                "en": "The portal was temporarily slow. The agent can retry with backoff.",
                "hi": "पोर्टल अस्थायी रूप से धीमा था। एजेंट बैकऑफ के साथ फिर कोशिश कर सकता है।",
                "mr": "पोर्टल तात्पुरते संथ होते. एजंट बॅकऑफसह पुन्हा प्रयत्न करू शकतो.",
            }[language]
            return ErrorInterpretation(action="retry", field=field, explanation=explanation)

        explanation = {
            "en": "The error is not safely auto-correctable. Please review the highlighted field.",
            "hi": "यह त्रुटि सुरक्षित रूप से स्वतः ठीक नहीं की जा सकती। कृपया चिह्नित फ़ील्ड जाँचें।",
            "mr": "ही त्रुटी सुरक्षितपणे स्वतः दुरुस्त करता येत नाही. कृपया चिन्हांकित क्षेत्र तपासा.",
        }[language]
        return ErrorInterpretation(
            action="needs_user_input",
            field=field,
            explanation=explanation,
        )
