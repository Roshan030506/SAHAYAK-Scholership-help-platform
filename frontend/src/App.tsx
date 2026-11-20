import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/app";
import i18n from "@/i18n";

const LandingPage = lazy(() =>
  import("@/pages/LandingPage").then((module) => ({ default: module.LandingPage })),
);
const ProfilePage = lazy(() =>
  import("@/pages/ProfilePage").then((module) => ({ default: module.ProfilePage })),
);
const ResultsPage = lazy(() =>
  import("@/pages/ResultsPage").then((module) => ({ default: module.ResultsPage })),
);
const SchemeDetailPage = lazy(() =>
  import("@/pages/SchemeDetailPage").then((module) => ({ default: module.SchemeDetailPage })),
);
const PrivacyPage = lazy(() =>
  import("@/pages/PrivacyPage").then((module) => ({ default: module.PrivacyPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);

function PageLoader() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 px-6" aria-busy="true">
      <span className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-saffron/20" aria-hidden="true" />
        <span className="relative h-9 w-9 animate-spin rounded-full border-[3px] border-saffron/30 border-t-saffron" />
      </span>
      <p className="font-heading text-sm font-semibold text-navy-soft">{t("loading.page")}</p>
    </div>
  );
}

function BootBanner() {
  const { t } = useTranslation();
  const bootError = useAppStore((state) => state.bootError);
  const bootstrapping = useAppStore((state) => state.bootstrapping);
  const bootstrap = useAppStore((state) => state.bootstrap);

  if (!bootError) return null;

  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-red-950" role="alert">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm font-medium">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>
            {t("errors.backendOffline")} <span className="text-red-800/75">{t("errors.retryHint")}</span>
          </span>
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="self-start border-red-200 bg-white text-red-800 hover:bg-red-100"
          onClick={() => void bootstrap()}
          loading={bootstrapping}
          iconLeft={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          {t("actions.retry")}
        </Button>
      </div>
    </div>
  );
}

function DocumentTitle() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();

  useEffect(() => {
    let key: "home" | "profile" | "results" | "scheme" | "privacy" | "notFound" = "notFound";
    if (pathname === "/") key = "home";
    else if (pathname === "/profile") key = "profile";
    else if (pathname === "/results") key = "results";
    else if (pathname.startsWith("/schemes/")) key = "scheme";
    else if (pathname === "/privacy") key = "privacy";
    document.title = t(`pageTitles.${key}`);
  }, [pathname, t, i18n.language]);

  return null;
}

function PreferencesSync() {
  const language = useAppStore((state) => state.language);
  const highContrast = useAppStore((state) => state.highContrast);
  const largeText = useAppStore((state) => state.largeText);
  const reduceMotion = useAppStore((state) => state.reduceMotion);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.contrast = highContrast ? "high" : "normal";
    root.dataset.largeText = largeText ? "true" : "false";
    root.dataset.reduceMotion = reduceMotion ? "true" : "false";
    root.style.fontSize = largeText ? "18px" : "16px";
    root.lang = language;
    void i18n.changeLanguage(language);
  }, [language, highContrast, largeText, reduceMotion]);

  return null;
}

function Bootstrap() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <DocumentTitle />
      <PreferencesSync />
      <Bootstrap />
      <AppShell>
        <BootBanner />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/schemes/:id" element={<SchemeDetailPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  );
}
