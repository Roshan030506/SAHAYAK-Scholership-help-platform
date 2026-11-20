import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Download,
  Mic,
  Pencil,
  RefreshCw,
  Sprout,
  Wallet,
  XCircle,
} from "lucide-react";

import { ResultCard } from "@/components/results/ResultCard";
import { MissingInfoModal } from "@/components/results/MissingInfoModal";
import { ReadAloudButton } from "@/components/voice/ReadAloudButton";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FadeIn } from "@/components/ui/Motion";
import { Pill, StatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, formatNumber, statusTone, cn } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { EligibilityResult } from "@/types/api";

type Filter = "all" | "eligible" | "likely" | "not_eligible";
type SortMode = "benefit" | "deadline" | "missing";

const FILTERS: Filter[] = ["all", "eligible", "likely", "not_eligible"];

const ResultsScene = lazy(() =>
  import("@/components/three/ResultsScene").then((module) => ({ default: module.ResultsScene })),
);

function SceneSkeleton() {
  return (
    <div className="flex h-full w-full items-end justify-center gap-3 px-10 pb-12 pt-8" aria-hidden="true">
      {[42, 68, 88, 56, 34].map((height, index) => (
        <div
          key={index}
          className="w-10 animate-pulse rounded-t-2xl rounded-b-md bg-teal/20"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

export function ResultsPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const profile = useAppStore((state) => state.profile);
  const match = useAppStore((state) => state.match);
  const runMatch = useAppStore((state) => state.runMatch);
  const openAssistant = useAppStore((state) => state.openAssistant);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("benefit");
  const [fillResult, setFillResult] = useState<EligibilityResult | null>(null);
  const [docsOpen, setDocsOpen] = useState(true);
  const [checkedDocuments, setCheckedDocuments] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem("sahayak.checkedDocuments") || "[]");
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const attemptedLanguage = useRef<string | null>(null);

  const hasProfile = Boolean(
    profile && Object.values(profile.fields).some((value) => value !== null && value !== undefined),
  );

  useEffect(() => {
    if (!hasProfile || loading) return;
    if (match?.language === language) return;
    if (attemptedLanguage.current === language) return;
    attemptedLanguage.current = language;
    setLoading(true);
    setError(false);
    runMatch(language)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [hasProfile, language, match?.language, runMatch, loading]);

  function retry() {
    attemptedLanguage.current = null;
    setError(false);
    setLoading(true);
    runMatch(language)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  const results = match?.results ?? [];
  const totalEligibleBenefit = useMemo(
    () =>
      results
        .filter((result) => result.status === "eligible")
        .reduce((sum, result) => sum + result.benefit_amount_per_year, 0),
    [results],
  );
  const totalPotentialBenefit = useMemo(
    () =>
      results
        .filter((result) => result.status === "likely")
        .reduce((sum, result) => sum + result.benefit_amount_per_year, 0),
    [results],
  );
  const counts = useMemo(
    () => ({
      eligible: results.filter((result) => result.status === "eligible").length,
      likely: results.filter((result) => result.status === "likely").length,
      not_eligible: results.filter((result) => result.status === "not_eligible").length,
    }),
    [results],
  );
  const filteredResults = useMemo(
    () => (filter === "all" ? results : results.filter((result) => result.status === filter)),
    [filter, results],
  );
  const sortedResults = useMemo(() => {
    const sorted = [...filteredResults];
    if (sortMode === "deadline") {
      sorted.sort((a, b) => a.deadline.localeCompare(b.deadline));
    } else if (sortMode === "missing") {
      sorted.sort((a, b) => a.unknown_count - b.unknown_count || b.passed_count - a.passed_count);
    } else {
      sorted.sort((a, b) => b.benefit_amount_per_year - a.benefit_amount_per_year || a.deadline.localeCompare(b.deadline));
    }
    return sorted;
  }, [filteredResults, sortMode]);

  const smartDocuments = useMemo(() => {
    const map = new Map<string, { type: string; label: string; unlocks: number }>();
    results
      .filter((result) => result.status === "eligible" || result.status === "likely")
      .forEach((result) => {
        result.required_documents.forEach((document) => {
          const current = map.get(document.type);
          map.set(document.type, {
            type: document.type,
            label: document.label,
            unlocks: (current?.unlocks ?? 0) + 1,
          });
        });
      });
    return Array.from(map.values()).sort((a, b) => b.unlocks - a.unlocks || a.label.localeCompare(b.label));
  }, [results]);
  const spokenSummary = useMemo(() => {
    if (!results.length) return t("assistant.replies.readResultsEmpty");
    const eligibleResults = results.filter((result) => result.status === "eligible");
    if (!eligibleResults.length) {
      return t("assistant.replies.readResultsNone", {
        likely: results.some((result) => result.status === "likely")
          ? t("assistant.replies.likelyLine", {
              names: results
                .filter((result) => result.status === "likely")
                .map((result) => result.short_name)
                .join(", "),
            })
          : "",
      });
    }
    return t("assistant.replies.readResults", {
      count: eligibleResults.length,
      names: eligibleResults.map((result) => result.short_name).join(", "),
      amount: t("assistant.replies.currencyAmount", {
        amount: formatNumber(totalEligibleBenefit, language),
      }),
    });
  }, [language, results, t, totalEligibleBenefit]);

  useEffect(() => {
    if (!sortedResults.length) {
      setSelectedId(null);
      return;
    }
    if (!sortedResults.some((result) => result.scheme_id === selectedId)) {
      setSelectedId(sortedResults[0].scheme_id);
    }
  }, [sortedResults, selectedId]);

  const selected = sortedResults.find((result) => result.scheme_id === selectedId) ?? null;

  function revealScheme(schemeId: string) {
    setSelectedId(schemeId);
    window.setTimeout(() => {
      document.getElementById("results-garden")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function askAboutScheme(result: EligibilityResult) {
    const met = result.passed_rules.map((rule) => rule.reason).join(" ");
    const missing = [
      ...result.unknown_rules.map((rule) => rule.reason),
      ...result.missing_document_labels.map((document) => `${t("results.missingDocs")}: ${document}`),
    ].join(" ");
    openAssistant({
      schemeId: result.scheme_id,
      text: t("results.contextPrompt", {
        scheme: result.scheme_name,
        deadline: formatDate(result.deadline, language),
        met,
        missing,
      }),
    });
  }

  function toggleDocument(type: string) {
    setCheckedDocuments((current) => {
      const next = current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type];
      window.localStorage.setItem("sahayak.checkedDocuments", JSON.stringify(next));
      return next;
    });
  }

  function printChecklist() {
    window.print();
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] garden-sky opacity-70" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 pb-36 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <FadeIn className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Pill tone="saffron" className="bg-white/70 backdrop-blur">
              {t("results.eyebrow")}
            </Pill>
            <h1 className="mt-4 max-w-3xl font-heading text-[2.2rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-navy sm:text-5xl">
              {t("results.title")}
            </h1>
            <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-navy-soft sm:text-base">
              {t("results.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <ReadAloudButton
              text={spokenSummary}
              language={language}
              label={t("results.listen")}
              stopLabel={t("actions.stop")}
              variant="secondary"
              size="sm"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openAssistant({ text: t("assistant.suggestions.eligibility") })}
              iconLeft={<Mic className="h-4 w-4" aria-hidden="true" />}
            >
              {t("results.ask")}
            </Button>
            <LinkButton
              to="/profile"
              variant="secondary"
              iconLeft={<Pencil className="h-4 w-4" aria-hidden="true" />}
              className="shrink-0"
            >
              {t("results.editProfile")}
            </LinkButton>
          </div>
        </FadeIn>

        {!hasProfile && !loading ? (
          <FadeIn className="mt-8">
            <Card tone="glass" padding="lg" className="mx-auto max-w-2xl text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal">
                <Sprout className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-heading text-2xl font-bold text-navy">{t("results.empty.title")}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy-soft">
                {t("results.empty.body")}
              </p>
              <LinkButton to="/profile" className="mt-5">
                {t("results.empty.cta")}
              </LinkButton>
            </Card>
          </FadeIn>
        ) : (
          <>
            <FadeIn delay={0.05} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  { key: "eligible", icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
                  { key: "likely", icon: CircleHelp, tone: "text-amber-600 bg-amber-50" },
                  { key: "not_eligible", icon: XCircle, tone: "text-slate-500 bg-slate-100" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(filter === item.key ? "all" : item.key)}
                  aria-pressed={filter === item.key}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-white/75 px-4 py-3.5 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30",
                    filter === item.key ? "border-teal/40 ring-2 ring-teal/10" : "border-white/80",
                  )}
                >
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", item.tone)}>
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-heading text-2xl font-bold leading-none text-navy">
                      {loading ? "—" : counts[item.key]}
                    </span>
                    <span className="mt-1 block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-navy-soft">
                      {t(`results.filter.${item.key}`)}
                    </span>
                  </span>
                </button>
              ))}
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-white px-4 py-3.5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-heading text-xl font-bold leading-none text-emerald-800">
                    {loading ? "—" : formatCurrency(totalEligibleBenefit, language)}
                  </span>
                  <span className="mt-1 block text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-emerald-800/75">
                    {t("results.confirmedBenefit")}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-white px-4 py-3.5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                  <CircleHelp className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-heading text-xl font-bold leading-none text-amber-900">
                    {loading ? "—" : formatCurrency(totalPotentialBenefit, language)}
                  </span>
                  <span className="mt-1 block text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-amber-900/75">
                    {t("results.possibleBenefit")}
                  </span>
                </span>
              </div>
              {/*
              <div className="flex items-center gap-3 rounded-2xl border border-teal/15 bg-gradient-to-br from-teal-50/80 to-white px-4 py-3.5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-white">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-heading text-2xl font-bold leading-none text-teal-dark">
                    {loading ? "—" : formatCurrency(totalEligibleBenefit, language)}
                  </span>
                  <span className="mt-1 block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-teal-dark/75">
                    {t("results.possibleBenefit")}
                  </span>
                </span>
              </div>
              */}
            </FadeIn>

            {loading ? (
              <div className="mt-6 space-y-4" aria-busy="true">
                <div className="h-72 animate-pulse rounded-3xl border border-white/70 bg-white/55" />
                <div className="h-44 animate-pulse rounded-3xl border border-white/70 bg-white/55" />
                <div className="h-44 animate-pulse rounded-3xl border border-white/70 bg-white/55" />
                <p className="text-sm font-medium text-navy-soft">{t("loading.results")}</p>
              </div>
            ) : error ? (
              <Card tone="glass" padding="lg" className="mt-6 text-center">
                <h2 className="font-heading text-xl font-bold text-navy">{t("toasts.matchFailed")}</h2>
                <p className="mt-2 text-sm text-navy-soft">{t("errors.retryHint")}</p>
                <Button
                  onClick={retry}
                  className="mt-4"
                  iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                >
                  {t("actions.retry")}
                </Button>
              </Card>
            ) : results.length ? (
              <>
                <FadeIn delay={0.08} className="mt-6">
                  <Card tone="glass" padding="md" className="overflow-hidden">
                    <div className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
                      <div id="results-garden" className="relative min-h-[19rem] overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-amber-50/70 via-white to-teal-50/60">
                        <Suspense fallback={<SceneSkeleton />}>
                          <ResultsScene
                            results={sortedResults}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            className="absolute inset-0"
                          />
                        </Suspense>
                        {!sortedResults.length ? (
                          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-medium text-navy-soft">
                            {t("results.noFilterMatches")}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <p className="font-heading text-[0.68rem] font-bold uppercase tracking-[0.18em] text-teal">
                          {t("results.sceneHint")}
                        </p>
                        {selected ? (
                          <div className="mt-3 rounded-2xl border border-navy/[0.07] bg-white/75 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={selected.status} />
                              <Pill tone="neutral">{t("results.rank", { rank: selected.rank })}</Pill>
                            </div>
                            <p className="mt-2 font-heading text-base font-bold leading-snug text-navy">
                              {selected.short_name}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-navy-soft">
                              <span className="inline-flex items-center gap-1">
                                <Wallet className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
                                {formatCurrency(selected.benefit_amount_per_year, language)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5 text-saffron-dark" aria-hidden="true" />
                                {formatDate(selected.deadline, language)}
                              </span>
                            </div>
                          </div>
                        ) : null}
                        <ul className="mt-3 space-y-1">
                          {sortedResults.map((result) => {
                            const tone = statusTone(result.status);
                            return (
                              <li key={result.scheme_id}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedId(result.scheme_id)}
                                  aria-pressed={selectedId === result.scheme_id}
                                  className={cn(
                                    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30",
                                    selectedId === result.scheme_id
                                      ? "bg-white shadow-sm ring-1 ring-teal/20"
                                      : "hover:bg-white/60",
                                  )}
                                >
                                  <span className="w-4 text-center font-heading text-[0.68rem] font-bold text-navy-soft/60">
                                    {result.rank}
                                  </span>
                                  <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} aria-hidden="true" />
                                  <span className="min-w-0 flex-1 truncate font-heading text-xs font-semibold text-navy">
                                    {result.short_name}
                                  </span>
                                  <span className="shrink-0 text-[0.65rem] font-medium text-navy-soft">
                                    {formatCurrency(result.benefit_amount_per_year, language)}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </Card>
                </FadeIn>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-heading text-xl font-bold tracking-tight text-navy">{t("results.listTitle")}</h2>
                    <p className="mt-1 text-xs font-medium text-navy-soft">
                      {t("results.summary", {
                        eligible: counts.eligible,
                        likely: counts.likely,
                        notEligible: counts.not_eligible,
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 rounded-full border border-navy/[0.07] bg-white/70 px-3 py-1.5 text-xs font-semibold text-navy-soft">
                      <span className="sr-only">{t("results.sortLabel")}</span>
                      <select
                        value={sortMode}
                        onChange={(event) => setSortMode(event.target.value as SortMode)}
                        className="bg-transparent pr-1 text-xs font-semibold text-navy outline-none"
                        aria-label={t("results.sortLabel")}
                      >
                        <option value="benefit">{t("results.sortBenefit")}</option>
                        <option value="deadline">{t("results.sortDeadline")}</option>
                        <option value="missing">{t("results.sortMissing")}</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={printChecklist}
                      className="inline-flex items-center gap-1.5 rounded-full border border-navy/[0.07] bg-white/70 px-3 py-2 font-heading text-xs font-semibold text-navy transition hover:bg-navy/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("results.printChecklist")}
                    </button>
                    <div
                      className="flex flex-wrap gap-1.5 rounded-full border border-navy/[0.07] bg-white/70 p-1.5 shadow-sm backdrop-blur"
                      role="group"
                      aria-label={t("results.listTitle")}
                    >
                      {FILTERS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setFilter(item)}
                          aria-pressed={filter === item}
                          className={cn(
                            "rounded-full px-3 py-1.5 font-heading text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30",
                            filter === item
                              ? "bg-navy text-white shadow-sm"
                              : "text-navy-soft hover:bg-navy/5 hover:text-navy",
                          )}
                        >
                          {t(`results.filter.${item}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {smartDocuments.length ? (
                  <details open={docsOpen} onToggle={(event) => setDocsOpen(event.currentTarget.open)} className="mt-4 rounded-2xl border border-navy/[0.07] bg-white/75 shadow-sm">
                    <summary className="cursor-pointer list-none px-4 py-3 font-heading text-sm font-bold text-navy">
                      {t("results.smartDocuments")} · {checkedDocuments.length}/{smartDocuments.length} {t("results.ready")}
                    </summary>
                    <div className="border-t border-navy/[0.06] p-4">
                      <div className="h-2 overflow-hidden rounded-full bg-navy/[0.07]">
                        <div
                          className="h-full rounded-full bg-teal transition-all"
                          style={{ width: `${smartDocuments.length ? (checkedDocuments.length / smartDocuments.length) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {smartDocuments.map((document) => (
                          <label key={document.type} className="flex cursor-pointer items-start gap-2 rounded-xl border border-navy/[0.06] bg-white px-3 py-2.5 text-xs text-navy-soft">
                            <input
                              type="checkbox"
                              checked={checkedDocuments.includes(document.type)}
                              onChange={() => toggleDocument(document.type)}
                              className="mt-0.5 h-4 w-4 accent-teal"
                            />
                            <span>
                              <span className="block font-semibold text-navy">{document.label}</span>
                              <span>{t("results.unlocks", { count: document.unlocks })}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </details>
                ) : null}

                <div className="mt-5">
                  {sortedResults.length ? (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {sortedResults.map((result: EligibilityResult, index) => (
                        <FadeIn key={result.scheme_id} delay={Math.min(index * 0.04, 0.2)}>
                          <ResultCard
                            result={result}
                            language={language}
                            selected={selectedId === result.scheme_id}
                            onReveal={revealScheme}
                            onFill={setFillResult}
                            onAsk={askAboutScheme}
                          />
                        </FadeIn>
                      ))}
                    </div>
                  ) : (
                    <Card tone="glass" padding="lg" className="text-center">
                      <p className="text-sm font-medium text-navy-soft">{t("results.noFilterMatches")}</p>
                      <Button variant="secondary" className="mt-3" onClick={() => setFilter("all")}>
                        {t("results.filter.all")}
                      </Button>
                    </Card>
                  )}
                </div>
              </>
            ) : (
              <Card tone="glass" padding="lg" className="mt-6 text-center">
                <Sprout className="mx-auto h-8 w-8 text-teal" aria-hidden="true" />
                <h2 className="mt-3 font-heading text-xl font-bold text-navy">{t("results.noProfile")}</h2>
                <LinkButton to="/profile" className="mt-4">
                  {t("results.empty.cta")}
                </LinkButton>
              </Card>
            )}
          </>
        )}
      </div>
      <section className="print-only" aria-label={t("results.printChecklist")}>
        <h1>{t("results.title")}</h1>
        {sortedResults.map((result) => (
          <article key={result.scheme_id}>
            <h2>{result.scheme_name}</h2>
            <p>{t(`status.${result.status}`)} · {formatCurrency(result.benefit_amount_per_year, language)} · {formatDate(result.deadline, language)}</p>
            {result.unknown_rules.length ? <p>{t("results.needsInfo")}: {result.missing_field_labels.join(", ")}</p> : null}
            {result.missing_document_labels.length ? <p>{t("results.missingDocs")}: {result.missing_document_labels.join(", ")}</p> : null}
          </article>
        ))}
      </section>
      <MissingInfoModal result={fillResult} onClose={() => setFillResult(null)} />
    </div>
  );
}
