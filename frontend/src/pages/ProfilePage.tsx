import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { ProfileForm } from "@/components/profile/ProfileForm";
import { VoicePanel } from "@/components/profile/VoicePanel";
import {
  draftFieldOrder,
  emptyDraft,
  fromProfileFields,
  toProfileFields,
  validateDraft,
} from "@/components/profile/draft";
import type { ProfileDraft } from "@/components/profile/draft";
import { FadeIn } from "@/components/ui/Motion";
import { Pill } from "@/components/ui/Badge";
import { sampleProfileFields, sampleProfileSentence } from "@/lib/sample";
import { useAppStore } from "@/store/app";
import { useToastStore } from "@/store/toast";
import type { ProfileFields } from "@/types/api";

export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useAppStore((state) => state.language);
  const profile = useAppStore((state) => state.profile);
  const bootstrapping = useAppStore((state) => state.bootstrapping);
  const saveProfile = useAppStore((state) => state.saveProfile);
  const runMatch = useAppStore((state) => state.runMatch);
  const pushToast = useToastStore((state) => state.push);

  const [draft, setDraft] = useState<ProfileDraft>({ ...emptyDraft });
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileDraft, string>>>({});
  const [saving, setSaving] = useState<"save" | "match" | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !profile) return;
    initialized.current = true;
    setDraft(fromProfileFields(profile.fields));
  }, [profile]);

  function handleChange(field: keyof ProfileDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }) as ProfileDraft);
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function handleExtracted(fields: ProfileFields) {
    setDraft(fromProfileFields(fields));
    setErrors({});
  }

  function useSample() {
    setDraft(fromProfileFields(sampleProfileFields));
    setText(sampleProfileSentence);
    setErrors({});
  }

  async function handleSave(andMatch: boolean) {
    if (saving) return;
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstField = draftFieldOrder.find((field) => nextErrors[field]);
      if (firstField) {
        const element = document.getElementById(`profile-${firstField}`);
        element?.scrollIntoView({ block: "center", behavior: "smooth" });
        element?.focus({ preventScroll: true });
      }
      return;
    }

    setSaving(andMatch ? "match" : "save");
    try {
      const response = await saveProfile(toProfileFields(draft), language);
      setDraft(fromProfileFields(response.fields));
      pushToast(t("toasts.profileSaved"), "success");
      if (andMatch) {
        try {
          await runMatch(language);
          navigate("/results");
        } catch {
          pushToast(t("toasts.matchFailed"), "error");
        }
      }
    } catch {
      pushToast(t("toasts.profileSaveFailed"), "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] garden-sky opacity-70" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <FadeIn className="grid gap-6 lg:grid-cols-[1.1fr_auto] lg:items-end">
          <div>
            <Pill tone="teal" className="bg-white/70 backdrop-blur">
              {t("profile.eyebrow")}
            </Pill>
            <h1 className="mt-4 max-w-2xl font-heading text-[2.2rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-navy sm:text-5xl">
              {t("profile.title")}
            </h1>
            <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-navy-soft sm:text-base">
              {t("profile.subtitle")}
            </p>
          </div>
          <ol className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/60 px-2 py-2 shadow-sm backdrop-blur lg:flex">
            <li className="inline-flex items-center gap-2 rounded-full bg-navy px-3.5 py-2 font-heading text-xs font-semibold text-white">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-saffron text-[0.65rem] font-bold text-navy">
                1
              </span>
              {t("nav.profile")}
            </li>
            <li className="inline-flex items-center gap-1.5 px-2 font-heading text-xs font-semibold text-navy-soft">
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              {t("nav.results")}
            </li>
          </ol>
        </FadeIn>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <FadeIn delay={0.05} className="lg:sticky lg:top-24">
            <VoicePanel
              language={language}
              text={text}
              onTextChange={setText}
              onExtracted={handleExtracted}
              onUseSample={useSample}
            />
          </FadeIn>

          <FadeIn delay={0.1}>
            {bootstrapping && !profile ? (
              <div className="space-y-4 rounded-3xl border border-white/70 bg-white/60 p-6 shadow-glass" aria-busy="true">
                <div className="h-6 w-40 animate-pulse rounded-full bg-navy/10" />
                <div className="h-4 w-full animate-pulse rounded-full bg-navy/5" />
                <div className="h-24 animate-pulse rounded-2xl bg-navy/5" />
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="h-12 animate-pulse rounded-xl bg-navy/5" />
                  ))}
                </div>
                <p className="text-sm font-medium text-navy-soft">{t("loading.profile")}</p>
              </div>
            ) : (
              <ProfileForm
                draft={draft}
                errors={errors}
                saving={saving}
                onChange={handleChange}
                onSave={(match) => void handleSave(match)}
                onUseSample={useSample}
              />
            )}
            <p className="mt-3 flex items-start gap-2 px-1 text-[0.7rem] leading-relaxed text-navy-soft/80">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
              {t("privacy.subtitle")}
            </p>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
