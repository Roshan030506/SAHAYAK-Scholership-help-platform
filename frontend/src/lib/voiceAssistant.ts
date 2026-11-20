import type { Language, Scheme } from "@/types/api";

export type AssistantPage = "home" | "profile" | "results" | "scheme" | "privacy" | "other";

export type RuleField =
  | "annual_family_income"
  | "age"
  | "category"
  | "education_level"
  | "last_exam_percentage"
  | "state"
  | "disability_status"
  | "bank_account_present"
  | "gender";

export type AssistantIntent =
  | { kind: "greeting" }
  | { kind: "help" }
  | { kind: "thanks" }
  | { kind: "stop" }
  | { kind: "repeat" }
  | { kind: "close" }
  | { kind: "navigate"; to: "/" | "/profile" | "/results" | "/privacy" }
  | { kind: "language"; language: Language }
  | { kind: "eligibility" }
  | { kind: "documents"; schemeId?: string }
  | { kind: "deadline"; schemeId?: string }
  | { kind: "schemeInfo"; schemeId?: string }
  | { kind: "why"; schemeId?: string }
  | { kind: "rule"; schemeId?: string; field?: RuleField }
  | { kind: "missingProfile" }
  | { kind: "readPage"; page: AssistantPage; schemeId?: string }
  | { kind: "fallback" };

export interface AssistantContext {
  page: AssistantPage;
  schemeId?: string;
  schemes: Scheme[];
}

export function assistantPageFromPath(pathname: string): AssistantPage {
  if (pathname === "/") return "home";
  if (pathname === "/profile") return "profile";
  if (pathname === "/results") return "results";
  if (pathname.startsWith("/schemes/")) return "scheme";
  if (pathname === "/privacy") return "privacy";
  return "other";
}

export function schemeIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/schemes\/([^/]+)/);
  return match?.[1];
}

const SCHEME_ALIASES: Record<string, string[]> = {
  "post-matric-sc": [
    "post matric",
    "post-matric",
    "sc scholarship",
    "scheduled caste scholarship",
    "पोस्ट मैट्रिक",
    "पोस्ट मॅट्रिक",
    "अनुसूचित जाति छात्रवृत्ति",
    "अनुसूचित जाती शिष्यवृत्ती",
  ],
  "central-sector-scholarship": [
    "central sector",
    "central scholarship",
    "केंद्रीय क्षेत्र",
    "केंद्रीय छात्रवृत्ति",
    "केंद्रीय शिष्यवृत्ती",
  ],
  "nmms-scholarship": [
    "nmms",
    "means cum merit",
    "means-cum-merit",
    "मीन्स कम मेरिट",
    "मीन्स कम मेरिट",
  ],
  "maha-fee-reimbursement": [
    "fee waiver",
    "fee reimbursement",
    "maharashtra fee",
    "maha fee",
    "फी माफी",
    "फीस माफी",
    "शिष्यवृत्ती फी",
    "फी परतावा",
  ],
  "disability-education-scholarship": [
    "divyang",
    "disability scholarship",
    "disabled scholarship",
    "दिव्यांग",
    "दिव्यांग छात्रवृत्ति",
    "दिव्यांगत्व शिष्यवृत्ती",
    "अपंग",
  ],
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "students",
  "student",
  "scholarship",
  "scholarships",
  "scheme",
  "schemes",
  "yojana",
  "of",
  "to",
  "in",
  "my",
  "me",
  "is",
  "are",
  "about",
  "tell",
  "know",
  "want",
  "need",
  "please",
  "छात्रवृत्ति",
  "शिष्यवृत्ती",
  "योजना",
  "योजने",
  "बारे",
  "बद्दल",
  "में",
  "माझ्या",
  "मेरे",
  "मेरी",
  "की",
  "का",
  "ची",
  "चा",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[-–—/]/g, " ")
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function findScheme(text: string, schemes: Scheme[]): string | undefined {
  const normalized = normalize(text);
  if (!normalized) return undefined;
  let best: { id: string; score: number } | null = null;

  for (const scheme of schemes) {
    const names = [
      scheme.name.en,
      scheme.name.hi,
      scheme.name.mr,
      scheme.short_name.en,
      scheme.short_name.hi,
      scheme.short_name.mr,
      scheme.id,
      ...(SCHEME_ALIASES[scheme.id] ?? []),
    ];
    let score = 0;
    for (const name of names) {
      const candidate = normalize(name);
      if (!candidate) continue;
      if (normalized.includes(candidate)) {
        score = Math.max(score, 100 + candidate.length);
        continue;
      }
      const candidateTokens = candidate
        .split(" ")
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
      if (!candidateTokens.length) continue;
      const overlap = candidateTokens.filter((token) => normalized.includes(token));
      if (overlap.length >= 2) {
        score = Math.max(score, 50 + overlap.length * 10);
      } else if (
        overlap.length === 1 &&
        candidateTokens.length === 1 &&
        overlap[0].length >= 5
      ) {
        score = Math.max(score, 30 + overlap[0].length);
      }
    }
    if (score > (best?.score ?? 0)) best = { id: scheme.id, score };
  }

  return best && best.score >= 35 ? best.id : undefined;
}

function detectRuleField(text: string): RuleField | undefined {
  if (hasAny(text, [/income|earning|salary|आय|उत्पन्न|कमाई/])) return "annual_family_income";
  if (hasAny(text, [/percentage|percent|marks|अंक|प्रतिशत|टक्के/])) return "last_exam_percentage";
  if (hasAny(text, [/\bage\b|how old|उम्र|वय|वर्ष/])) return "age";
  if (hasAny(text, [/category|caste|श्रेणी|जाति|जात|प्रवर्ग/])) return "category";
  if (hasAny(text, [/education|study|studying|course|class|पढ़|शिक्षा|शिक्षण|अभ्यास|इयत्ता/])) {
    return "education_level";
  }
  if (hasAny(text, [/disability|disabled|divyang|दिव्यांग|दिव्यांगत्व|अपंग/])) {
    return "disability_status";
  }
  if (hasAny(text, [/bank|बैंक|बँक/])) return "bank_account_present";
  if (hasAny(text, [/gender|female|male|girl|boy|महिला|लड़की|मुलगी|लिंग/])) return "gender";
  if (hasAny(text, [/state|domicile|राज्य|महाराष्ट्र|महाराष्ट्रात/])) return "state";
  return undefined;
}

/**
 * Turn a spoken or typed sentence into a small, deterministic intent.
 *
 * The assistant only answers from scheme JSON and saved eligibility results,
 * so an unrecognised sentence falls back to a capability prompt instead of an
 * invented answer.
 */
export function detectIntent(input: string, context: AssistantContext): AssistantIntent {
  const text = normalize(input);
  if (!text) return { kind: "help" };

  const schemeId = findScheme(input, context.schemes) ?? context.schemeId;

  if (
    hasAny(text, [
      /^(close|exit|goodbye|bye)\b/,
      /^(बंद करो|बंद कर|बंद)$/,
      /^(बंद करा|बंद)$/,
    ])
  ) {
    return { kind: "close" };
  }

  if (
    hasAny(text, [
      /\b(repeat|say (that|it) again|once more|again please)\b/,
      /(फिर से|दोबारा|पुन्हा|पुन्हा सांगा)/,
    ])
  ) {
    return { kind: "repeat" };
  }

  if (hasAny(text, [/^(stop|cancel|quiet|silence|never mind)\b/, /^(रुको|थांबा|गप्प)/])) {
    return { kind: "stop" };
  }

  if (hasAny(text, [/hindi|हिंदी|हिन्दी/])) return { kind: "language", language: "hi" };
  if (hasAny(text, [/marathi|मराठी/])) return { kind: "language", language: "mr" };
  if (hasAny(text, [/english|अंग्रेज़ी|अंग्रेजी|इंग्रजी/])) return { kind: "language", language: "en" };

  if (hasAny(text, [/\bthank(s| you)?\b|धन्यवाद|आभार/])) return { kind: "thanks" };

  const navigateVerb = hasAny(text, [
    /\b(open|go|take me|navigate|move to|show me the)\b/,
    /\bshow me (my )?(results|matches|profile)\b/,
    /(खोलो|ले चलो|जाओ|दिखाओ|उघडा|चला|दाखवा|नेऊ)/,
  ]);
  const isShortDestination = /^(home|profile|results|matches|privacy|होम|मुख्यपृष्ठ|प्रोफ़ाइल|प्रोफाइल|मेल|परिणाम|जुळण्या|निकाल|गोपनीयता|डेटा)$/.test(
    text,
  );
  if (navigateVerb || isShortDestination) {
    if (hasAny(text, [/profile|प्रोफ़ाइल|प्रोफाइल/])) {
      return { kind: "navigate", to: "/profile" };
    }
    if (hasAny(text, [/privacy|data|गोपनीयता|डेटा|माहिती/])) {
      return { kind: "navigate", to: "/privacy" };
    }
    if (hasAny(text, [/results?|matches|परिणाम|मेल|जुळण्या|निकाल/])) {
      return { kind: "navigate", to: "/results" };
    }
    if (hasAny(text, [/home|start|main page|होम|मुख्यपृष्ठ|मुख्य पान|घर/])) {
      return { kind: "navigate", to: "/" };
    }
  }

  if (hasAny(text, [/read|read aloud|speak|पढ़|पढ़कर|सुनाओ|वाच|वाचून|ऐकवा/])) {
    if (hasAny(text, [/results?|matches|परिणाम|मेल|जुळण्या|निकाल/])) {
      return { kind: "readPage", page: "results" };
    }
    if (hasAny(text, [/profile|प्रोफ़ाइल|प्रोफाइल/])) {
      return { kind: "readPage", page: "profile" };
    }
    if (schemeId) return { kind: "readPage", page: "scheme", schemeId };
    return { kind: "readPage", page: context.page };
  }

  if (hasAny(text, [/why|reason|not eligible|did not match|rejected|क्यों|कारण|का नाही|नाकार|का नाकारले/])) {
    return { kind: "why", schemeId };
  }

  if (hasAny(text, [/document|paper|docs|कागज|दस्तावेज|दस्तावेज़|कागदपत्र|कागद/])) {
    return { kind: "documents", schemeId };
  }

  if (hasAny(text, [/deadline|last date|last day|when.*apply|कब|अंतिम तिथि|तारीख|केव्हा|शेवटची/])) {
    return { kind: "deadline", schemeId };
  }

  const ruleField = detectRuleField(text);
  const looksLikeRuleQuestion = hasAny(text, [
    /limit|criteria|condition|requirement|rule|cut ?off|सीमा|नियम|शर्त|मर्यादा|अट/,
    /how much|how many|कितना|कितनी|किती/i,
  ]);
  if (ruleField && (looksLikeRuleQuestion || hasAny(text, [/what|क्या|काय/]))) {
    return { kind: "rule", schemeId, field: ruleField };
  }

  if (hasAny(text, [/eligible|eligib|qualify|match|benefit|पात्र|योग्य|मेल|जुळण|लाभ/])) {
    return { kind: "eligibility" };
  }

  if (hasAny(text, [/missing|complete|incomplete|बाकी|पूरा|अपूर्ण|गहाळ|पूर्ण/])) {
    return { kind: "missingProfile" };
  }

  if (schemeId) return { kind: "schemeInfo", schemeId };

  if (hasAny(text, [/scheme|scholarship|योजना|छात्रवृत्ति|शिष्यवृत्ती/])) {
    return { kind: "schemeInfo" };
  }

  if (hasAny(text, [/^(hello|hi|hey|namaste|नमस्ते|नमस्कार)/])) {
    return { kind: "greeting" };
  }

  if (hasAny(text, [/help|what can (you|i) do|how do you|मदद|सहायता|मदत|काय कर/])) {
    return { kind: "help" };
  }

  return { kind: "fallback" };
}
