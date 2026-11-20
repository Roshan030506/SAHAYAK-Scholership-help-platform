import type { TFunction } from "i18next";

import type { AssistantIntent, AssistantPage } from "@/lib/voiceAssistant";
import { formatDate, formatNumber } from "@/lib/utils";
import type {
  EligibilityResult,
  Language,
  LocalizedText,
  MatchResponse,
  ProfileResponse,
  Scheme,
} from "@/types/api";

export interface AssistantReply {
  text: string;
  action?: { type: "navigate"; to: string };
  speakLanguage?: Language;
  silent?: boolean;
  closeAfterSpeak?: boolean;
}

export interface ReplyContext {
  t: TFunction;
  language: Language;
  page: AssistantPage;
  schemeId?: string;
  schemes: Scheme[];
  profile: ProfileResponse | null;
  match: MatchResponse | null;
  lastAssistantText?: string;
}

const localeMap: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
};

function localized(text: LocalizedText, language: Language): string {
  return text[language] || text.en;
}

function joinList(items: string[], language: Language): string {
  if (items.length <= 1) return items[0] ?? "";
  try {
    return new Intl.ListFormat(localeMap[language], {
      style: "long",
      type: "conjunction",
    }).format(items);
  } catch {
    return items.join(", ");
  }
}

function fieldLabel(t: TFunction, field: string): string {
  return t(`profile.fields.${field}`, { defaultValue: field });
}

function profileFieldsPresent(profile: ProfileResponse | null): boolean {
  if (!profile) return false;
  return Object.values(profile.fields).some(
    (value) => value !== null && value !== undefined && value !== "",
  );
}

function resultFor(match: MatchResponse | null, schemeId?: string): EligibilityResult | null {
  if (!match || !schemeId) return null;
  return match.results.find((result) => result.scheme_id === schemeId) ?? null;
}

function schemeFor(context: ReplyContext, schemeId?: string): Scheme | null {
  const id = schemeId ?? context.schemeId;
  if (!id) return null;
  return context.schemes.find((scheme) => scheme.id === id) ?? null;
}

function amountPhrase(t: TFunction, language: Language, amount: number): string {
  return t("assistant.replies.currencyAmount", { amount: formatNumber(amount, language) });
}

function docsLine(t: TFunction, scheme: Scheme, language: Language): string {
  const labels = scheme.required_documents.map((document) => localized(document.label, language));
  return t("assistant.replies.documentsScheme", {
    scheme: localized(scheme.short_name, language),
    documents: joinList(labels, language),
  });
}

function navigateReply(t: TFunction, to: "/" | "/profile" | "/results" | "/privacy"): AssistantReply {
  const pageKey = to === "/" ? "home" : to.slice(1);
  return {
    text: t("assistant.replies.navigate", { page: t(`assistant.pages.${pageKey}`) }),
    action: { type: "navigate", to },
  };
}

/**
 * Compose a spoken reply from deterministic data only.
 *
 * Every statement comes from the saved profile, the eligibility engine output,
 * or the scheme JSON that the user can open and verify.
 */
export function buildReply(intent: AssistantIntent, context: ReplyContext): AssistantReply {
  const { t, language, profile, match, schemes } = context;
  const schemeNames = schemes.map((scheme) => localized(scheme.short_name, language));
  const hasProfile = profileFieldsPresent(profile);
  const results = match?.results ?? [];
  const eligible = results.filter((result) => result.status === "eligible");
  const likely = results.filter((result) => result.status === "likely");
  const potentialBenefit = eligible.reduce(
    (sum, result) => sum + result.benefit_amount_per_year,
    0,
  );

  switch (intent.kind) {
    case "greeting":
      return { text: t("assistant.replies.greeting") };

    case "help":
      return { text: t("assistant.replies.help") };

    case "thanks":
      return { text: t("assistant.replies.thanks") };

    case "stop":
      return { text: t("assistant.replies.stop"), silent: true };

    case "repeat":
      return {
        text: context.lastAssistantText || t("assistant.replies.nothingToRepeat"),
      };

    case "close":
      return {
        text: t("assistant.replies.farewell"),
        closeAfterSpeak: true,
      };

    case "navigate":
      return navigateReply(t, intent.to);

    case "language": {
      const targetLanguage = intent.language;
      const languageName = t(`language.names.${targetLanguage}`);
      return {
        text: t("assistant.replies.language", { language: languageName }),
        speakLanguage: targetLanguage,
      };
    }

    case "eligibility": {
      if (!hasProfile) return { text: t("assistant.replies.noProfile") };
      if (!match) return { text: t("assistant.replies.noMatch") };
      const parts: string[] = [];
      if (eligible.length) {
        parts.push(
          t("assistant.replies.eligibilityHead", {
            count: eligible.length,
            names: joinList(
              eligible.map((result) => result.short_name),
              language,
            ),
          }),
        );
        if (potentialBenefit > 0) {
          parts.push(
            t("assistant.replies.benefitLine", { amount: amountPhrase(t, language, potentialBenefit) }),
          );
        }
        parts.push(t("assistant.replies.eligibilityFollowUp"));
      } else {
        parts.push(t("assistant.replies.eligibilityNone"));
      }
      if (likely.length) {
        parts.push(
          t("assistant.replies.likelyLine", {
            names: joinList(
              likely.map((result) => result.short_name),
              language,
            ),
          }),
        );
      }
      return { text: parts.join(" ") };
    }

    case "documents": {
      const scheme = schemeFor(context, intent.schemeId);
      if (scheme) {
        const result = resultFor(match, scheme.id);
        const parts = [docsLine(t, scheme, language)];
        if (!result) {
          parts.push(t("assistant.replies.documentsNoResult"));
        } else if (result.missing_document_labels.length) {
          parts.push(
            t("assistant.replies.documentsMissing", {
              documents: joinList(result.missing_document_labels, language),
            }),
          );
        } else {
          parts.push(t("assistant.replies.documentsAll"));
        }
        return { text: parts.join(" ") };
      }
      if (!hasProfile) return { text: t("assistant.replies.noProfile") };
      if (!match) return { text: t("assistant.replies.documentsNoMatch") };
      const missing = Array.from(
        new Set(
          results
            .filter((result) => result.status !== "not_eligible")
            .flatMap((result) => result.missing_document_labels),
        ),
      );
      if (!missing.length) return { text: t("assistant.replies.documentsNone") };
      return {
        text: t("assistant.replies.documentsGeneric", {
          documents: joinList(missing, language),
        }),
      };
    }

    case "deadline": {
      const scheme = schemeFor(context, intent.schemeId);
      if (scheme) {
        return {
          text: t("assistant.replies.deadlineScheme", {
            scheme: localized(scheme.short_name, language),
            date: formatDate(scheme.deadline, language),
          }),
        };
      }
      if (!match || !results.length) return { text: t("assistant.replies.deadlinesNone") };
      const relevant = results.filter((result) => result.status !== "not_eligible");
      if (!relevant.length) return { text: t("assistant.replies.deadlinesNone") };
      const items = relevant.map((result) =>
        t("assistant.replies.deadlineItem", {
          scheme: result.short_name,
          date: formatDate(result.deadline, language),
        }),
      );
      return {
        text: t("assistant.replies.deadlines", {
          items: items.join("; "),
        }),
      };
    }

    case "schemeInfo": {
      const scheme = schemeFor(context, intent.schemeId);
      if (!scheme) {
        if (!schemes.length) return { text: t("assistant.replies.noSchemes") };
        return {
          text: t("assistant.replies.schemeList", {
            names: joinList(schemeNames, language),
          }),
        };
      }
      const result = resultFor(match, scheme.id);
      const parts = [
        t("assistant.replies.schemeInfo", {
          scheme: localized(scheme.name, language),
          authority: localized(scheme.authority, language),
          amount: amountPhrase(t, language, scheme.benefit_amount_per_year),
          date: formatDate(scheme.deadline, language),
        }),
        t("assistant.replies.schemeInfoDocs", {
          count: scheme.required_documents.length,
        }),
      ];
      if (result) {
        parts.push(
          t("assistant.replies.schemeInfoStatus", {
            status: t(`status.${result.status}`),
          }),
        );
      } else {
        parts.push(t("assistant.replies.schemeInfoNoStatus"));
      }
      return { text: parts.join(" ") };
    }

    case "why": {
      const scheme = schemeFor(context, intent.schemeId);
      if (!scheme) {
        return {
          text: t("assistant.replies.whyNoScheme", {
            names: joinList(schemeNames, language),
          }),
        };
      }
      const result = resultFor(match, scheme.id);
      if (!result) {
        return {
          text: t("assistant.replies.whyNoResult", {
            scheme: localized(scheme.short_name, language),
          }),
        };
      }
      if (!result.failed_rules.length) {
        return {
          text: t("assistant.replies.whyNone", {
            scheme: localized(scheme.short_name, language),
          }),
        };
      }
      const reasons = result.failed_rules
        .slice(0, 3)
        .map((rule) => rule.reason)
        .join(" ");
      return {
        text: t("assistant.replies.whyIntro", {
          scheme: localized(scheme.short_name, language),
          count: result.failed_rules.length,
          reasons,
        }),
      };
    }

    case "rule": {
      const scheme = schemeFor(context, intent.schemeId);
      if (!scheme) {
        return {
          text: t("assistant.replies.ruleNoScheme", {
            names: joinList(schemeNames, language),
          }),
        };
      }
      const rule = intent.field
        ? scheme.rules.find((item) => item.field === intent.field)
        : undefined;
      if (!rule) {
        return {
          text: t("assistant.replies.ruleNoRule", {
            scheme: localized(scheme.short_name, language),
          }),
        };
      }
      const result = resultFor(match, scheme.id);
      const outcome = result
        ? result.failed_rules.some((item) => item.field === rule.field)
          ? t("results.failed")
          : result.unknown_rules.some((item) => item.field === rule.field)
            ? t("results.needsInfo")
            : t("results.passed")
        : t("assistant.replies.ruleNoResult");
      return {
        text: t("assistant.replies.rule", {
          scheme: localized(scheme.short_name, language),
          label: localized(rule.label, language),
          outcome,
        }),
      };
    }

    case "missingProfile": {
      if (!profile || !hasProfile) return { text: t("assistant.replies.noProfile") };
      const missing = profile.missing_fields.map((field) => fieldLabel(t, field));
      if (!missing.length || profile.completeness >= 1) {
        return { text: t("assistant.replies.profileComplete") };
      }
      return {
        text: t("assistant.replies.missingProfile", {
          percent: Math.round(profile.completeness * 100),
          fields: joinList(missing, language),
        }),
      };
    }

    case "readPage": {
      if (intent.page === "home") return { text: t("assistant.replies.readHome") };
      if (intent.page === "privacy") return { text: t("assistant.replies.readPrivacy") };
      if (intent.page === "profile") {
        if (!profile || !hasProfile) return { text: t("assistant.replies.noProfile") };
        const missing = profile.missing_fields.map((field) => fieldLabel(t, field));
        if (!missing.length || profile.completeness >= 1) {
          return { text: t("assistant.replies.profileComplete") };
        }
        return {
          text: t("assistant.replies.readProfile", {
            percent: Math.round(profile.completeness * 100),
            fields: joinList(missing, language),
          }),
        };
      }
      if (intent.page === "results") {
        if (!match) return { text: t("assistant.replies.readResultsEmpty") };
        if (!eligible.length) {
          return {
            text: t("assistant.replies.readResultsNone", {
              likely: likely.length
                ? t("assistant.replies.likelyLine", {
                    names: joinList(
                      likely.map((result) => result.short_name),
                      language,
                    ),
                  })
                : "",
            }),
          };
        }
        return {
          text: t("assistant.replies.readResults", {
            count: eligible.length,
            names: joinList(
              eligible.map((result) => result.short_name),
              language,
            ),
            amount: amountPhrase(t, language, potentialBenefit),
          }),
        };
      }
      if (intent.page === "scheme") {
        const scheme = schemeFor(context, intent.schemeId);
        if (!scheme) {
          return {
            text: t("assistant.replies.readSchemePrompt", {
              names: joinList(schemeNames, language),
            }),
          };
        }
        const result = resultFor(match, scheme.id);
        const documents = scheme.required_documents
          .map((document) => localized(document.label, language))
          .join(", ");
        const parts = [
          t("assistant.replies.readScheme", {
            scheme: localized(scheme.name, language),
            description: localized(scheme.description, language),
            amount: amountPhrase(t, language, scheme.benefit_amount_per_year),
            date: formatDate(scheme.deadline, language),
            documents,
          }),
        ];
        if (result) {
          parts.push(
            t("assistant.replies.schemeInfoStatus", {
              status: t(`status.${result.status}`),
            }),
          );
          if (result.missing_document_labels.length) {
            parts.push(
              t("assistant.replies.documentsMissing", {
                documents: joinList(result.missing_document_labels, language),
              }),
            );
          }
        }
        return { text: parts.join(" ") };
      }
      return { text: t("assistant.replies.readOther") };
    }

    case "fallback":
      return { text: t("assistant.replies.fallback") };
  }

  return { text: t("assistant.replies.fallback") };
}
