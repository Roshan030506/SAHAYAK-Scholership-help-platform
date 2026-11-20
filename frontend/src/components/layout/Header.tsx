import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Accessibility, Check, Globe2, Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Brand } from "@/components/layout/Brand";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";
import type { Language } from "@/types/api";

const navItems = [
  { to: "/", key: "nav.home", end: true },
  { to: "/profile", key: "nav.profile", end: false },
  { to: "/results", key: "nav.results", end: false },
  { to: "/privacy", key: "nav.privacy", end: false },
] as const;

function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  return (
    <label
      className={cn(
        "relative flex items-center gap-2 rounded-full border border-navy/10 bg-white/80 pl-3 pr-2 text-sm font-medium text-navy shadow-sm backdrop-blur transition hover:border-teal/30",
        compact ? "h-10" : "h-11",
      )}
    >
      <Globe2 className="h-4 w-4 text-teal" aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="cursor-pointer appearance-none bg-transparent py-1 pr-5 font-heading text-sm font-semibold text-navy focus:outline-none"
        aria-label={t("language.label")}
      >
        <option value="en">{t("language.names.en")}</option>
        <option value="hi">{t("language.names.hi")}</option>
        <option value="mr">{t("language.names.mr")}</option>
      </select>
      <svg
        viewBox="0 0 10 6"
        className="pointer-events-none absolute right-2.5 h-1.5 w-2.5 text-navy-soft"
        aria-hidden="true"
      >
        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    </label>
  );
}

function AccessibilityMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const highContrast = useAppStore((state) => state.highContrast);
  const largeText = useAppStore((state) => state.largeText);
  const reduceMotion = useAppStore((state) => state.reduceMotion);
  const setHighContrast = useAppStore((state) => state.setHighContrast);
  const setLargeText = useAppStore((state) => state.setLargeText);
  const setReduceMotion = useAppStore((state) => state.setReduceMotion);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const options = [
    { key: "highContrast", label: t("accessibility.highContrast"), value: highContrast, set: setHighContrast },
    { key: "largeText", label: t("accessibility.largeText"), value: largeText, set: setLargeText },
    { key: "reduceMotion", label: t("accessibility.reduceMotion"), value: reduceMotion, set: setReduceMotion },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border border-navy/10 bg-white/80 text-navy-soft shadow-sm backdrop-blur transition hover:border-teal/30 hover:text-teal focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30",
          open && "border-teal/40 text-teal",
        )}
        aria-label={t("a11y.accessibility")}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Accessibility className="h-5 w-5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t("accessibility.title")}
          className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-navy/10 bg-white p-3 shadow-[0_20px_60px_rgba(11,27,58,0.18)]"
        >
          <p className="px-2 pb-2 font-heading text-sm font-semibold text-navy">
            {t("accessibility.title")}
          </p>
          <ul className="space-y-1">
            {options.map((option) => (
              <li key={option.key}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={option.value}
                  onClick={() => option.set(!option.value)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-navy-soft transition hover:bg-navy/[0.04]"
                >
                  <span>{option.label}</span>
                  <span
                    className={cn(
                      "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
                      option.value ? "bg-teal" : "bg-navy/15",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform",
                        option.value && "translate-x-4",
                      )}
                    >
                      {option.value ? (
                        <Check className="h-2.5 w-2.5 text-teal" aria-hidden="true" />
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function Header() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-cream/80 shadow-[0_8px_30px_rgba(11,27,58,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Brand onClick={() => setMobileOpen(false)} />

        <nav aria-label={t("a11y.mainNav")} className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 font-heading text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30",
                  isActive
                    ? "bg-navy text-white shadow-[0_8px_20px_rgba(11,27,58,0.18)]"
                    : "text-navy-soft hover:-translate-y-px hover:bg-navy/5 hover:text-navy",
                )
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSelect compact />
          </div>
          <AccessibilityMenu />
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-navy/10 bg-white/80 text-navy shadow-sm lg:hidden"
            aria-label={mobileOpen ? t("a11y.closeMenu") : t("a11y.openMenu")}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div id="mobile-nav" className="border-t border-navy/5 bg-cream/95 px-4 py-4 shadow-lg backdrop-blur-xl lg:hidden">
          <nav aria-label={t("a11y.mainNav")} className="grid gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "rounded-xl px-4 py-3 font-heading text-base font-semibold transition-colors",
                    isActive ? "bg-navy text-white" : "text-navy-soft hover:bg-navy/5",
                  )
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 border-t border-navy/5 pt-3 sm:hidden">
            <LanguageSelect />
          </div>
        </div>
      ) : null}
    </header>
  );
}
