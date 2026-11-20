import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  FileText,
  Gavel,
  Landmark,
  Mail,
  MapPin,
  Mic,
  Phone,
  ShieldCheck,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react";

import { ReadAloudButton } from "@/components/voice/ReadAloudButton";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FadeIn } from "@/components/ui/Motion";
import { Pill, StatusBadge } from "@/components/ui/Badge";
import { MissingInfoModal } from "@/components/results/MissingInfoModal";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, cn, statusTone } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { EligibilityResult, Language, LocalizedText, Scheme } from "@/types/api";

function localized(text: LocalizedText, language: Language): string {
  return text[language] || text.en;
}

function OutcomeIcon({ outcome }: { outcome: "passed" | "failed" | "unknown" | null }) {
  if (outcome === "passed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
  if (outcome === "failed") return <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />;
  if (outcome === "unknown") return <CircleHelp className="h-4 w-4 text-amber-600" aria-hidden="true" />;
  return <span className="h-4 w-4 rounded-full border border-navy/15" aria-hidden="true" />;
}

function ruleOutcome(
  result: EligibilityResult | null,
  field: string,
): "passed" | "failed" | "unknown" | null {
  if (!result) return null;
  if (result.failed_rules.some((rule) => rule.field === field)) return "failed";
  if (result.passed_rules.some((rule) => rule.field === field)) return "passed";
  if (result.unknown_rules.some((rule) => rule.field === field)) return "unknown";
  return null;
}

export function SchemeDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const language = useAppStore((state) => state.language);
  const schemes = useAppStore((state) => state.schemes);
  const match = useAppStore((state) => state.match);
  const profile = useAppStore((state) => state.profile);
  const runMatch = useAppStore((state) => state.runMatch);
  const openAssistant = useAppStore((state) => state.openAssistant);

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const attemptedLanguage = useRef<string | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);

  const hasProfile = Boolean(
    profile && Object.values(profile.fields).some((value) => value !== null && value !== undefined),
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const cached = schemes.find((item) => item.id === id) ?? null;
    setScheme(cached);
    setLoading(!cached);
    setError(false);
    api
      .getScheme(id)
      .then((response) => {
        if (!cancelled) setScheme(response.scheme);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, schemes]);

  useEffect(() => {
    if (!hasProfile || matchLoading) return;
    if (match?.language === language) return;
    if (attemptedLanguage.current === language) return;
    attemptedLanguage.current = language;
    setMatchLoading(true);
    runMatch(language)
      .catch(() => undefined)
      .finally(() => setMatchLoading(false));
  }, [hasProfile, language, match?.language, runMatch, matchLoading]);

  const result = useMemo(
    () => match?.results.find((item) => item.scheme_id === scheme?.id) ?? null,
    [match, scheme?.id],
  );

  if (loading && !scheme) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" aria-busy="true">
        <div className="h-5 w-32 animate-pulse rounded-full bg-navy/10" />
        <div className="mt-6 h-16 w-2/3 animate-pulse rounded-2xl bg-navy/10" />
        <div className="mt-4 h-5 w-1/2 animate-pulse rounded-full bg-navy/5" />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-white/60" />
          ))}
        </div>
        <p className="mt-6 text-sm font-medium text-navy-soft">{t("loading.page")}</p>
      </div>
    );
  }

  if (error && !scheme) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <Card tone="glass" padding="lg">
          <h1 className="font-heading text-2xl font-bold text-navy">{t("scheme.notFound")}</h1>
          <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>
            {t("actions.retry")}
          </Button>
          <LinkButton to="/results" variant="ghost" className="mt-2" iconLeft={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
            {t("scheme.backToResults")}
          </LinkButton>
        </Card>
      </div>
    );
  }

  if (!scheme) return null;

  const tone = result ? statusTone(result.status) : null;
  const spokenSummary = [
    localized(scheme.name, language),
    localized(scheme.authority, language),
    localized(scheme.description, language),
    `${t("scheme.benefit")}: ${formatCurrency(scheme.benefit_amount_per_year, language)}.`,
    `${t("scheme.deadline")}: ${formatDate(scheme.deadline, language)}.`,
    `${t("scheme.documentsTitle")}: ${scheme.required_documents
      .map((document) => localized(document.label, language))
      .join(", ")}.`,
    result ? `${t(`status.${result.status}`)}. ${result.status_summary}` : "",
    result?.missing_document_labels.length
      ? `${t("results.missingDocs")}: ${result.missing_document_labels.join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[24rem] garden-sky opacity-60" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <Link
          to="/results"
          className="inline-flex items-center gap-2 rounded-full px-2 py-1 font-heading text-sm font-semibold text-navy-soft transition hover:text-navy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("scheme.backToResults")}
        </Link>

        <FadeIn className="mt-5">
          <Card tone="glass" padding="lg" className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-saffron/15 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="teal">{t("scheme.eyebrow")}</Pill>
                  {result ? <StatusBadge status={result.status} /> : null}
                  {matchLoading ? (
                    <span className="text-xs font-medium text-navy-soft">{t("loading.page")}</span>
                  ) : null}
                </div>
                <h1 className="mt-4 max-w-3xl font-heading text-[2rem] font-extrabold leading-[1.06] tracking-[-0.03em] text-navy sm:text-4xl">
                  {localized(scheme.name, language)}
                </h1>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-navy-soft">
                  <Landmark className="h-4 w-4 text-teal" aria-hidden="true" />
                  {localized(scheme.authority, language)}
                </p>
                <p className="mt-4 max-w-3xl text-[0.95rem] leading-relaxed text-navy-soft">
                  {localized(scheme.description, language)}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {scheme.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-navy/[0.07] bg-white/70 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-navy-soft"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ReadAloudButton
                    text={spokenSummary}
                    language={language}
                    label={t("scheme.listen")}
                    stopLabel={t("actions.stop")}
                    variant="secondary"
                    size="sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      openAssistant({
                        text: result
                          ? t("results.contextPrompt", {
                              scheme: result.scheme_name,
                              deadline: formatDate(result.deadline, language),
                              met: result.passed_rules.map((rule) => rule.reason).join(" "),
                              missing: [
                                ...result.unknown_rules.map((rule) => rule.reason),
                                ...result.missing_document_labels,
                              ].join(" "),
                            })
                          : t("assistant.prompts.schemeInfo"),
                        schemeId: scheme.id,
                      })
                    }
                    iconLeft={<Mic className="h-4 w-4" aria-hidden="true" />}
                  >
                    {t("scheme.chatComing")}
                  </Button>
                </div>
              </div>

              <dl className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-3">
                  <dt className="flex items-center gap-1.5 font-heading text-[0.65rem] font-bold uppercase tracking-[0.12em] text-amber-800">
                    <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("scheme.benefit")}
                  </dt>
                  <dd className="mt-1 font-heading text-xl font-bold text-amber-950">
                    {formatCurrency(scheme.benefit_amount_per_year, language)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-navy/[0.07] bg-white/75 px-4 py-3">
                  <dt className="flex items-center gap-1.5 font-heading text-[0.65rem] font-bold uppercase tracking-[0.12em] text-navy-soft">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("scheme.deadline")}
                  </dt>
                  <dd className="mt-1 font-heading text-xl font-bold text-navy">
                    {formatDate(scheme.deadline, language)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-teal/15 bg-teal-50/70 px-4 py-3">
                  <dt className="flex items-center gap-1.5 font-heading text-[0.65rem] font-bold uppercase tracking-[0.12em] text-teal-dark">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("scheme.documentsTitle")}
                  </dt>
                  <dd className="mt-1 font-heading text-xl font-bold text-teal-dark">
                    {scheme.required_documents.length}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
        </FadeIn>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="space-y-6">
            <FadeIn delay={0.05}>
              <Card padding="lg">
                <h2 className="font-heading text-xl font-bold tracking-tight text-navy">{t("scheme.rulesTitle")}</h2>
                <ul className="mt-4 space-y-2">
                  {scheme.rules.map((rule) => {
                    const outcome = ruleOutcome(result, rule.field);
                    const outcomeLabel =
                      outcome === "passed"
                        ? t("results.passed")
                        : outcome === "failed"
                          ? t("results.failed")
                          : outcome === "unknown"
                            ? t("results.needsInfo")
                            : null;
                    return (
                      <li
                        key={`${rule.field}-${rule.operator}`}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border px-3.5 py-3",
                          outcome === "passed"
                            ? "border-emerald-200/70 bg-emerald-50/50"
                            : outcome === "failed"
                              ? "border-red-200/70 bg-red-50/40"
                              : outcome === "unknown"
                                ? "border-amber-200/70 bg-amber-50/40"
                                : "border-navy/[0.06] bg-navy/[0.015]",
                        )}
                      >
                        <span className="mt-0.5">
                          <OutcomeIcon outcome={outcome} />
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-navy">
                          {localized(rule.label, language)}
                        </span>
                        {outcomeLabel ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide",
                              outcome === "passed"
                                ? "bg-emerald-100 text-emerald-800"
                                : outcome === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-800",
                            )}
                          >
                            {outcomeLabel}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {!result ? (
                  <p className="mt-3 rounded-xl bg-navy/[0.03] px-3 py-2 text-xs leading-relaxed text-navy-soft">
                    {t("results.noProfile")}
                  </p>
                ) : null}
              </Card>
            </FadeIn>

            <FadeIn delay={0.1}>
              <Card padding="lg">
                <h2 className="font-heading text-xl font-bold tracking-tight text-navy">{t("scheme.documentsTitle")}</h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {scheme.required_documents.map((document) => {
                    const missing = result?.missing_documents.includes(document.type) ?? false;
                    const uploaded = Boolean(result && !missing);
                    return (
                      <li
                        key={document.type}
                        className="flex items-center gap-2.5 rounded-xl border border-navy/[0.06] bg-white px-3.5 py-3"
                      >
                        {uploaded ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        ) : missing ? (
                          <XCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0 text-navy-soft/60" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1 text-sm font-medium text-navy">
                          {localized(document.label, language)}
                        </span>
                        <span className="shrink-0 text-[0.62rem] font-bold uppercase tracking-wide text-navy-soft/60">
                          {uploaded ? t("scheme.found") : missing ? t("scheme.missing") : t("scheme.required")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </FadeIn>

            <FadeIn delay={0.15}>
              <Card padding="lg">
                <h2 className="font-heading text-xl font-bold tracking-tight text-navy">{t("scheme.rightsTitle")}</h2>
                <ul className="mt-4 space-y-3">
                  {scheme.rights.map((right) => (
                    <li key={localized(right.title, "en")} className="flex items-start gap-3 rounded-2xl border border-teal/10 bg-teal-50/35 px-4 py-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
                      <div>
                        <p className="font-heading text-sm font-semibold text-navy">{localized(right.title, language)}</p>
                        <p className="mt-1 text-xs leading-relaxed text-navy-soft">{localized(right.detail, language)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </FadeIn>
          </div>

          <div className="space-y-5 lg:sticky lg:top-24">
            <FadeIn delay={0.06}>
              <Card
                tone={result ? "default" : "warm"}
                padding="md"
                className={cn(result && tone ? tone.border : "")}
              >
                <h2 className="font-heading text-lg font-bold tracking-tight text-navy">{t("scheme.statusTitle")}</h2>
                {result ? (
                  <>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={result.status} />
                      <span className="text-xs font-semibold text-navy-soft">
                        {t("results.rank", { rank: result.rank })}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-navy-soft">{result.status_summary}</p>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-emerald-50 px-2 py-2">
                        <p className="font-heading text-lg font-bold text-emerald-700">{result.passed_count}</p>
                        <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-emerald-800/70">{t("results.passed")}</p>
                      </div>
                      <div className="rounded-xl bg-red-50 px-2 py-2">
                        <p className="font-heading text-lg font-bold text-red-600">{result.failed_count}</p>
                        <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-red-700/70">{t("results.failed")}</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 px-2 py-2">
                        <p className="font-heading text-lg font-bold text-amber-700">{result.unknown_count}</p>
                        <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-amber-800/70">{t("results.needsInfo")}</p>
                      </div>
                    </div>
                    {result.missing_document_labels.length ? (
                      <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2">
                        <p className="font-heading text-[0.65rem] font-bold uppercase tracking-[0.1em] text-amber-900">
                          {t("results.missingDocs")}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-amber-950">
                          {result.missing_document_labels.join(", ")}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-medium text-emerald-700">{t("results.allDocs")}</p>
                    )}
                    {result.status === "likely" && result.missing_field_labels.length ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => setFillOpen(true)}
                      >
                        {t("results.fillMissing")}
                      </Button>
                    ) : null}
                    <LinkButton to="/results" variant="secondary" size="sm" className="mt-4 w-full">
                      {t("scheme.backToResults")}
                    </LinkButton>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-relaxed text-navy-soft">{t("results.noProfile")}</p>
                    <LinkButton
                      to={hasProfile ? "/results" : "/profile"}
                      size="sm"
                      className="mt-4 w-full"
                      iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                    >
                      {hasProfile ? t("results.viewMatches") : t("results.empty.cta")}
                    </LinkButton>
                  </>
                )}
              </Card>
            </FadeIn>

            <FadeIn delay={0.1}>
              <Card padding="md">
                <h2 className="font-heading text-base font-bold tracking-tight text-navy">{t("scheme.grievanceTitle")}</h2>
                <p className="mt-2 inline-flex items-center gap-2 font-heading text-sm font-semibold text-teal-dark">
                  <Gavel className="h-4 w-4" aria-hidden="true" />
                  {scheme.grievance_contact.name}
                </p>
                <ul className="mt-3 space-y-2 text-xs font-medium text-navy-soft">
                  <li>
                    <a href={`tel:${scheme.grievance_contact.phone}`} className="inline-flex items-center gap-1.5 rounded transition hover:text-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40">
                      <Phone className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
                      {scheme.grievance_contact.phone}
                    </a>
                  </li>
                  <li>
                    <a href={`mailto:${scheme.grievance_contact.email}`} className="inline-flex items-center gap-1.5 rounded transition hover:text-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40">
                      <Mail className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
                      {scheme.grievance_contact.email}
                    </a>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
                    {scheme.grievance_contact.address}
                  </li>
                </ul>
              </Card>
            </FadeIn>

            <FadeIn delay={0.14}>
              <Card tone="dark" padding="md">
                <h2 className="font-heading text-base font-bold tracking-tight text-white">{t("scheme.sourceTitle")}</h2>
                <p className="mt-2 text-xs leading-relaxed text-white/65">{t("scheme.sourceNotice")}</p>
                {scheme.apply_url.startsWith("http") ? (
                  <a
                    href={scheme.apply_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal px-4 py-2.5 font-heading text-xs font-bold text-white transition hover:bg-teal-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/30"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("scheme.applyNow")}
                  </a>
                ) : (
                  <Link
                    to={scheme.apply_url}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal px-4 py-2.5 font-heading text-xs font-bold text-white transition hover:bg-teal-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/30"
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("scheme.applyNow")}
                  </Link>
                )}
                <a
                  href={scheme.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-saffron px-4 py-2 font-heading text-xs font-bold text-navy transition hover:bg-saffron-light focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/40"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("scheme.officialSource")}
                </a>
                <p className="mt-3 flex items-start gap-1.5 text-[0.68rem] leading-relaxed text-white/50">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-saffron-light" aria-hidden="true" />
                  {t("scheme.applyComing")}
                </p>
              </Card>
            </FadeIn>
          </div>
        </div>
      </div>
      <MissingInfoModal result={fillOpen ? result : null} onClose={() => setFillOpen(false)} />
    </div>
  );
}
