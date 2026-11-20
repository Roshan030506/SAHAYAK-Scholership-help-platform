import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  FileWarning,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react";

import { ReadAloudButton } from "@/components/voice/ReadAloudButton";
import { StatusBadge, Pill } from "@/components/ui/Badge";
import { cn, formatCurrency, formatDate, statusTone } from "@/lib/utils";
import type { EligibilityResult, Language } from "@/types/api";

interface ResultCardProps {
  result: EligibilityResult;
  language: Language;
  selected: boolean;
  onReveal: (schemeId: string) => void;
  onFill: (result: EligibilityResult) => void;
  onAsk: (result: EligibilityResult) => void;
}

export function ResultCard({ result, language, selected, onReveal, onFill, onAsk }: ResultCardProps) {
  const { t } = useTranslation();
  const tone = statusTone(result.status);
  const spokenSummary = [
    result.scheme_name,
    t(`status.${result.status}`),
    result.status_summary,
    `${t("results.annualBenefit")}: ${formatCurrency(result.benefit_amount_per_year, language)}.`,
    `${t("results.deadline")}: ${formatDate(result.deadline, language)}.`,
    result.missing_document_labels.length
      ? `${t("results.missingDocs")}: ${result.missing_document_labels.join(", ")}.`
      : t("results.allDocs"),
  ].join(" ");
  const deadlineDays = Math.ceil(
    (new Date(`${result.deadline}T00:00:00`).getTime() - Date.now()) / 86400000,
  );
  const deadlineSoon = deadlineDays >= 0 && deadlineDays <= 45;
  const rules = [
    { key: "passed", items: result.passed_rules, icon: CheckCircle2, tone: "text-emerald-600" },
    { key: "failed", items: result.failed_rules, icon: XCircle, tone: "text-red-600" },
    { key: "needsInfo", items: result.unknown_rules, icon: CircleHelp, tone: "text-amber-600" },
  ] as const;

  return (
    <article
      id={`scheme-card-${result.scheme_id}`}
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-white shadow-[0_16px_50px_rgba(11,27,58,0.07)] transition-shadow",
        selected ? "border-teal/40 shadow-[0_22px_60px_rgba(15,118,110,0.14)]" : "border-navy/[0.08]",
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-1", tone.dot)} aria-hidden="true" />
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-navy/[0.07] bg-navy/[0.025] font-heading text-sm font-bold text-navy">
            {result.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-lg font-bold leading-snug tracking-tight text-navy sm:text-xl">
                <Link
                  to={`/schemes/${result.scheme_id}`}
                  className="rounded transition hover:text-teal-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
                >
                  {result.scheme_name}
                </Link>
              </h3>
              <StatusBadge status={result.status} />
            </div>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.1em] text-navy-soft/65">
              {result.authority}
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-navy-soft">{result.status_summary}</p>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-navy/[0.06] bg-navy/[0.02] px-3 py-2.5">
            <dt className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-navy-soft/70">
              <Wallet className="h-3 w-3" aria-hidden="true" />
              {t("results.annualBenefit")}
            </dt>
            <dd className="mt-0.5 font-heading text-sm font-bold text-navy">
              {formatCurrency(result.benefit_amount_per_year, language)}
            </dd>
          </div>
          <div className="rounded-2xl border border-navy/[0.06] bg-navy/[0.02] px-3 py-2.5">
            <dt className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-navy-soft/70">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              {t("results.deadline")}
            </dt>
            <dd className="mt-0.5 font-heading text-sm font-bold text-navy">
              {formatDate(result.deadline, language)}
              {deadlineSoon ? (
                <span className="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[0.58rem] text-red-700">
                  {t("results.deadlineSoon")}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="col-span-2 rounded-2xl border border-navy/[0.06] bg-navy/[0.02] px-3 py-2.5 sm:col-span-1">
            <dt className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-navy-soft/70">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {t("results.why")}
            </dt>
            <dd className="mt-0.5 font-heading text-sm font-bold text-navy">
              {result.passed_count}/{result.total_rules}
            </dd>
          </div>
        </dl>

        {result.missing_document_labels.length ? (
          <div className="mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-3.5 py-3">
            <p className="flex items-center gap-1.5 font-heading text-[0.7rem] font-bold uppercase tracking-[0.1em] text-amber-900">
              <FileWarning className="h-3.5 w-3.5" aria-hidden="true" />
              {t("results.missingDocs")} · {result.missing_document_labels.length}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {result.missing_document_labels.map((document) => (
                <span
                  key={document}
                  className="rounded-full border border-amber-200 bg-white/80 px-2.5 py-0.5 text-[0.68rem] font-medium text-amber-900"
                >
                  {document}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[0.7rem] font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("results.allDocs")}
          </p>
        )}

        <div className="mt-3 rounded-2xl border border-navy/[0.07] bg-navy/[0.02] px-3.5 py-3">
          <p className="font-heading text-[0.68rem] font-bold uppercase tracking-[0.1em] text-navy-soft/75">
            {t("results.profileQuestions")}
          </p>
          {result.missing_field_labels.length ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.72rem] font-medium text-navy-soft">
              <Pill tone="neutral" className="normal-case tracking-normal">
                {t("results.needsInfo")}
              </Pill>
              {result.missing_field_labels.join(", ")}
            </p>
          ) : (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("results.profileCriteriaMet")}
            </p>
          )}
        </div>

        <details className="group mt-4 rounded-2xl border border-navy/[0.06]" open={result.status !== "eligible"}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-heading text-sm font-semibold text-navy transition hover:bg-navy/[0.02] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-saffron-dark" aria-hidden="true" />
              {t("results.why")}
            </span>
            <ChevronDown className="h-4 w-4 text-navy-soft transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-3 border-t border-navy/[0.05] px-4 py-3">
            {rules.map((group) =>
              group.items.length ? (
                <div key={group.key}>
                  <p className="mb-1.5 font-heading text-[0.68rem] font-bold uppercase tracking-[0.12em] text-navy-soft/70">
                    {t(`results.${group.key}`)} · {group.items.length}
                  </p>
                  <ul className="space-y-1.5">
                    {group.items.map((rule) => (
                      <li key={`${rule.field}-${rule.reason_key}`} className="flex items-start gap-2 text-xs leading-relaxed text-navy-soft">
                        <group.icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", group.tone)} aria-hidden="true" />
                        <span>{rule.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </details>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <ReadAloudButton
              text={spokenSummary}
              language={language}
              label={t("results.listenScheme")}
              stopLabel={t("actions.stop")}
              variant="ghost"
              iconOnly
            />
            {result.status === "likely" && result.missing_field_labels.length ? (
              <button
                type="button"
                onClick={() => onFill(result)}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-heading text-xs font-semibold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
              >
                {t("results.fillMissing")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onReveal(result.scheme_id)}
              aria-pressed={selected}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-heading text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30",
                selected ? "bg-teal-50 text-teal-dark" : "text-navy-soft hover:bg-navy/5 hover:text-navy",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t("results.showInGarden")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAsk(result)}
              className="inline-flex items-center gap-1.5 rounded-full border border-navy/10 px-3.5 py-1.5 font-heading text-xs font-semibold text-navy-soft transition hover:bg-navy/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
            >
              {t("results.ask")}
            </button>
            <Link
              to={`/schemes/${result.scheme_id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-1.5 font-heading text-xs font-semibold text-white transition hover:bg-navy-light focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
            >
              {t("actions.viewDetails")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
