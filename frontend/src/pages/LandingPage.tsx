import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ExternalLink,
  FileCheck2,
  Gavel,
  Globe2,
  Landmark,
  Languages,
  Mic,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { GardenFallback } from "@/components/three/GardenFallback";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Badge";
import { FadeIn, SectionHeading } from "@/components/ui/Motion";
import { sampleProfileFields } from "@/lib/sample";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { api, getSchemeAuthority, getSchemeDescription, getSchemeName } from "@/lib/api";
import type { Portal, PortalGroup } from "@/types/api";
import { useAppStore } from "@/store/app";
import { useToastStore } from "@/store/toast";

const LandingScene = lazy(() =>
  import("@/components/three/LandingScene").then((module) => ({ default: module.LandingScene })),
);

const PORTAL_GROUP_META: Record<PortalGroup, { icon: LucideIcon; className: string }> = {
  central: {
    icon: Landmark,
    className: "bg-amber-50 text-amber-800 ring-amber-200/70",
  },
  state: {
    icon: ShieldCheck,
    className: "bg-teal-50 text-teal-dark ring-teal/20",
  },
  discovery: {
    icon: Globe2,
    className: "bg-sky-50 text-sky-800 ring-sky-200/70",
  },
  csr: {
    icon: Sparkles,
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200/70",
  },
};

export function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useAppStore((state) => state.language);
  const schemes = useAppStore((state) => state.schemes);
  const saveProfile = useAppStore((state) => state.saveProfile);
  const runMatch = useAppStore((state) => state.runMatch);
  const openAssistant = useAppStore((state) => state.openAssistant);
  const pushToast = useToastStore((state) => state.push);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [portals, setPortals] = useState<Portal[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .listPortals()
      .then((response) => {
        if (!cancelled) setPortals(response.portals);
      })
      .catch(() => {
        // The directory is supplementary; the rest of the landing page still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadSample() {
    setSampleLoading(true);
    try {
      await saveProfile(sampleProfileFields, language);
      await runMatch(language);
      pushToast(t("toasts.demoReady"), "success");
      navigate("/results");
    } catch {
      pushToast(t("toasts.genericError"), "error");
    } finally {
      setSampleLoading(false);
    }
  }

  const trustItems = [
    { icon: Gavel, text: t("landing.trust.rules") },
    { icon: ShieldCheck, text: t("landing.trust.privacy") },
    { icon: ScrollText, text: t("landing.trust.audit") },
  ];

  const steps = [
    {
      icon: Mic,
      title: t("landing.how.step1.title"),
      body: t("landing.how.step1.description"),
    },
    {
      icon: FileCheck2,
      title: t("landing.how.step2.title"),
      body: t("landing.how.step2.description"),
    },
    {
      icon: BadgeCheck,
      title: t("landing.how.step3.title"),
      body: t("landing.how.step3.description"),
    },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 garden-sky opacity-90" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -right-32 top-10 h-80 w-80 rounded-full border border-saffron/15 bg-saffron/[0.04] blur-2xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-40 top-72 h-96 w-96 rounded-full border border-teal/10 bg-teal/[0.04] blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14 lg:px-8 lg:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-6">
          <FadeIn className="relative z-10">
            <Pill tone="saffron" className="mb-5 bg-white/70 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t("landing.eyebrow")}
            </Pill>
            <h1 className="font-heading text-[2.85rem] font-extrabold leading-[0.98] tracking-[-0.045em] text-navy sm:text-6xl lg:text-[4.4rem]">
              {t("landing.title")}{" "}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-amber-600 via-saffron to-teal bg-clip-text text-transparent">
                  {t("landing.titleAccent")}
                </span>
                <span
                  className="absolute -bottom-1 left-0 h-3 w-full -rotate-1 rounded-full bg-saffron/20 sm:h-4"
                  aria-hidden="true"
                />
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-navy-soft sm:text-[1.06rem]">
              {t("landing.subtitle")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton
                to="/profile"
                size="lg"
                iconLeft={<Mic className="h-5 w-5" aria-hidden="true" />}
                iconRight={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
                className="w-full sm:w-auto"
              >
                {t("landing.ctaProfile")}
              </LinkButton>
              <button
                type="button"
                onClick={() => void loadSample()}
                disabled={sampleLoading}
                className={cn(
                  "inline-flex min-h-[3.35rem] w-full items-center justify-center gap-2 rounded-full border border-teal/20 bg-white/80 px-7 py-3 font-heading text-base font-semibold text-teal-dark shadow-sm backdrop-blur transition hover:border-teal/40 hover:bg-white disabled:cursor-wait disabled:opacity-60 sm:w-auto",
                )}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {sampleLoading ? t("landing.demoLoading") : t("landing.ctaDemo")}
              </button>
            </div>

            <button
              type="button"
              onClick={() => openAssistant()}
              className="mt-3 inline-flex items-center gap-2 rounded-full px-2 py-1.5 font-heading text-sm font-semibold text-teal-dark transition hover:text-teal focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-teal/15">
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {t("landing.ctaVoice")}
              <span className="font-body text-xs font-medium text-navy-soft">
                {t("landing.ctaVoiceHint")}
              </span>
            </button>

            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-3">
              {[
                { value: schemes.length || 14, label: t("landing.stats.schemes") },
                { value: 3, label: t("landing.stats.languages") },
                { value: "100%", label: t("landing.stats.consent") },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/70 bg-white/55 px-3 py-3 backdrop-blur-sm sm:px-4"
                >
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block font-heading text-xl font-bold text-navy sm:text-2xl">
                      {stat.value}
                    </span>
                    <span className="mt-0.5 block text-[0.68rem] font-medium leading-snug text-navy-soft">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </FadeIn>

          <FadeIn delay={0.12} className="relative">
            <div className="relative mx-auto h-[24rem] w-full max-w-[34rem] overflow-hidden rounded-[2.6rem] border border-white/80 bg-white/35 shadow-glass backdrop-blur-sm sm:h-[30rem] lg:h-[34rem]">
              <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-teal-50/50" aria-hidden="true" />
              <Suspense fallback={<GardenFallback className="absolute inset-0" />}>
                <LandingScene className="absolute inset-0" />
              </Suspense>
              <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/80 bg-white/85 px-3 py-2 shadow-sm backdrop-blur sm:left-5 sm:top-5">
                <p className="font-heading text-[0.68rem] font-bold uppercase tracking-[0.16em] text-teal">
                  {t("landing.stats.consent")}
                </p>
              </div>
              <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm backdrop-blur sm:bottom-5 sm:left-5 sm:right-5">
                <span className="inline-flex items-center gap-2 font-heading text-xs font-semibold text-navy">
                  <Languages className="h-4 w-4 text-teal" aria-hidden="true" />
                  English · हिन्दी · मराठी
                </span>
                <span className="hidden items-center gap-1.5 text-[0.7rem] font-medium text-navy-soft sm:inline-flex">
                  <Sparkles className="h-3.5 w-3.5 text-saffron" aria-hidden="true" />
                  {t("landing.scene.live")}
                </span>
              </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.2} className="mt-12 grid gap-3 md:grid-cols-3">
          {trustItems.map((item) => (
            <div
              key={item.text}
              className="interactive-surface flex items-start gap-3 rounded-2xl border border-white/70 bg-white/55 p-4 backdrop-blur-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal">
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium leading-relaxed text-navy-soft">{item.text}</p>
            </div>
          ))}
        </FadeIn>
      </div>

      <section className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <FadeIn>
          <SectionHeading
            eyebrow={t("landing.how.eyebrow")}
            title={t("landing.how.title")}
            subtitle={t("landing.how.subtitle")}
            align="center"
          />
        </FadeIn>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <FadeIn key={step.title} delay={0.08 * index}>
              <Card tone="glass" padding="lg" className="interactive-surface relative h-full">
                <span className="absolute right-5 top-4 font-heading text-5xl font-extrabold text-navy/[0.05]">
                  0{index + 1}
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-saffron/15 to-teal/10 text-teal ring-1 ring-teal/10">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-heading text-lg font-semibold text-navy">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-soft">{step.body}</p>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
        <FadeIn className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading title={t("landing.schemes.title")} subtitle={t("landing.schemes.subtitle")} />
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 self-start rounded-full px-2 py-1 font-heading text-sm font-semibold text-teal transition hover:text-teal-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30 sm:self-auto"
          >
            {t("landing.ctaProfile")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </FadeIn>

        {schemes.length === 0 ? (
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-52 animate-pulse rounded-3xl border border-white/70 bg-white/55"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : (
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {schemes.map((scheme, index) => (
              <FadeIn key={scheme.id} delay={Math.min(index * 0.05, 0.2)}>
                <Link
                  to={`/schemes/${scheme.id}`}
                  className="interactive-surface group flex h-full flex-col rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_16px_50px_rgba(11,27,58,0.07)] backdrop-blur focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-amber-800 ring-1 ring-amber-200/70">
                      <Wallet className="h-3 w-3" aria-hidden="true" />
                      {t("landing.schemes.benefit", {
                        amount: formatCurrency(scheme.benefit_amount_per_year, language),
                      })}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy/5 bg-white text-teal transition group-hover:border-teal/25 group-hover:bg-teal-50">
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-semibold leading-snug text-navy group-hover:text-teal-dark">
                    {getSchemeName(scheme, language)}
                  </h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-navy-soft/70">
                    {getSchemeAuthority(scheme, language)}
                  </p>
                  <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-navy-soft">
                    {getSchemeDescription(scheme, language)}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-navy/5 pt-3 text-xs font-medium text-navy-soft">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-saffron-dark" aria-hidden="true" />
                      {t("landing.schemes.deadline", {
                        date: formatDate(scheme.deadline, language),
                      })}
                    </span>
                    {scheme.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-navy/5 bg-navy/[0.03] px-2 py-0.5 text-[0.65rem] uppercase tracking-wide"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              </FadeIn>
            ))}
            <FadeIn delay={0.25}>
              <div className="flex h-full flex-col justify-between rounded-3xl border border-dashed border-teal/25 bg-gradient-to-br from-teal-50/70 to-white p-5">
                <div>
                  <Pill tone="teal">{t("landing.more.badge")}</Pill>
                  <h3 className="mt-4 font-heading text-lg font-semibold text-navy">
                    {t("landing.more.title")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-soft">
                    {t("landing.more.body")}
                  </p>
                </div>
                <LinkButton
                  to="/profile"
                  variant="secondary"
                  size="sm"
                  className="mt-5 self-start"
                  iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                >
                  {t("landing.ctaProfile")}
                </LinkButton>
              </div>
            </FadeIn>
          </div>
        )}
      </section>

      {portals.length ? (
        <section className="relative mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
          <FadeIn>
            <SectionHeading
              eyebrow={t("landing.portals.eyebrow")}
              title={t("landing.portals.title")}
              subtitle={t("landing.portals.subtitle")}
              align="center"
            />
          </FadeIn>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {portals.map((portal, index) => {
              const meta = PORTAL_GROUP_META[portal.group];
              const portalName = portal.name[language] || portal.name.en;
              const portalAuthority = portal.authority[language] || portal.authority.en;
              const portalDescription = portal.description[language] || portal.description.en;
              return (
                <FadeIn key={portal.id} delay={Math.min(index * 0.04, 0.2)}>
                  <a
                    href={portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="interactive-surface group flex h-full flex-col rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_16px_50px_rgba(11,27,58,0.07)] backdrop-blur focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] ring-1",
                          meta.className,
                        )}
                      >
                        <meta.icon className="h-3 w-3" aria-hidden="true" />
                        {t(`landing.portals.groups.${portal.group}`)}
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy/5 bg-white text-teal transition group-hover:border-teal/25 group-hover:bg-teal-50">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>
                    <h3 className="mt-4 font-heading text-lg font-semibold leading-snug text-navy group-hover:text-teal-dark">
                      {portalName}
                    </h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-navy-soft/70">
                      {portalAuthority}
                    </p>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-navy-soft">
                      {portalDescription}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 border-t border-navy/5 pt-3 font-heading text-xs font-semibold text-teal">
                      {t("landing.portals.visit")}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </a>
                </FadeIn>
              );
            })}
          </div>
          <p className="mx-auto mt-6 flex max-w-2xl items-start justify-center gap-2 text-center text-xs leading-relaxed text-navy-soft">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
            {t("landing.portals.note")}
          </p>
        </section>
      ) : null}

      <section className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="relative overflow-hidden rounded-[2.2rem] bg-navy px-6 py-10 text-white shadow-[0_30px_80px_rgba(11,27,58,0.3)] sm:px-10 sm:py-12">
            <div
              className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-saffron/20 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-teal/25 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative grid items-center gap-7 lg:grid-cols-[1.3fr_auto]">
              <div>
                <p className="font-heading text-xs font-bold uppercase tracking-[0.22em] text-saffron-light">
                  {t("landing.trust.title")}
                </p>
                <h2 className="mt-2 max-w-2xl font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                  {t("landing.how.title")}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
                  {t("landing.subtitle")}
                </p>
              </div>
              <LinkButton
                to="/profile"
                size="lg"
                variant="saffron"
                iconRight={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
              >
                {t("landing.ctaProfile")}
              </LinkButton>
            </div>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
