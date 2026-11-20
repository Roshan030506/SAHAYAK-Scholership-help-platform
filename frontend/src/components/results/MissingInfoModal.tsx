import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, X } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/app";
import type { EligibilityResult, ProfileFields } from "@/types/api";

interface MissingInfoModalProps {
  result: EligibilityResult | null;
  onClose: () => void;
}

const textFields = new Set(["name", "state", "district", "course"]);

export function MissingInfoModal({ result, onClose }: MissingInfoModalProps) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const profile = useAppStore((state) => state.profile);
  const saveProfile = useAppStore((state) => state.saveProfile);
  const runMatch = useAppStore((state) => state.runMatch);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [values, setValues] = useState<Partial<ProfileFields>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!result) return;
    const initial: Partial<ProfileFields> = {};
    result.unknown_rules.forEach((rule) => {
      const field = rule.field as keyof ProfileFields;
      initial[field] = profile?.fields[field] as never;
    });
    setValues(initial);
    window.setTimeout(() => closeRef.current?.focus(), 0);
  }, [profile?.fields, result]);

  useEffect(() => {
    if (!result) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, result]);

  if (!result) return null;

  async function submit() {
    setSaving(true);
    try {
      await saveProfile(values as ProfileFields, language);
      await runMatch(language);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function setField(field: keyof ProfileFields, value: ProfileFields[keyof ProfileFields]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-navy/30 p-3 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card
        tone="glass"
        padding="lg"
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto"
      >
        <div role="dialog" aria-modal="true" aria-labelledby="missing-info-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-heading text-[0.68rem] font-bold uppercase tracking-[0.16em] text-teal">
                {t("results.fillMissing")}
              </p>
              <h2 id="missing-info-title" className="mt-1 font-heading text-xl font-bold text-navy">
                {result.scheme_name}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t("actions.close")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-navy/10 bg-white text-navy-soft hover:text-navy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {result.unknown_rules.map((rule) => {
              const field = rule.field as keyof ProfileFields;
              const label = t(`profile.fields.${field}`, { defaultValue: rule.reason });
              const value = values[field];

              if (field === "bank_account_present" || field === "disability_status") {
                return (
                  <fieldset key={field} className="rounded-2xl border border-navy/[0.08] bg-white/70 p-3">
                    <legend className="px-1 text-sm font-semibold text-navy">{label}</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {[true, false].map((option) => (
                        <button
                          key={String(option)}
                          type="button"
                          aria-pressed={value === option}
                          onClick={() => setField(field, option)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                            value === option
                              ? "border-teal bg-teal-50 text-teal-dark"
                              : "border-navy/10 bg-white text-navy-soft"
                          }`}
                        >
                          {option ? t("quickAnswer.yes") : t("quickAnswer.no")}
                        </button>
                      ))}
                    </div>
                    {field === "disability_status" ? (
                      <p className="mt-2 text-xs text-navy-soft">{t("quickAnswer.disabilityHint")}</p>
                    ) : null}
                  </fieldset>
                );
              }

              if (field === "category") {
                return (
                  <label key={field} className="block text-sm font-semibold text-navy">
                    {label}
                    <select value={typeof value === "string" ? value : ""} onChange={(event) => setField(field, event.target.value as ProfileFields["category"])} className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-3 py-2.5 text-sm">
                      <option value="">--</option>
                      {["General", "OBC", "SC", "ST", "EWS"].map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                );
              }

              if (field === "education_level") {
                return (
                  <label key={field} className="block text-sm font-semibold text-navy">
                    {label}
                    <select value={typeof value === "string" ? value : ""} onChange={(event) => setField(field, event.target.value as ProfileFields["education_level"])} className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-3 py-2.5 text-sm">
                      <option value="">--</option>
                      {["class_8", "class_9", "class_10", "class_11", "class_12", "undergraduate", "postgraduate", "diploma", "iti"].map((option) => (
                        <option key={option} value={option}>{t(`profile.options.education.${option}`, { defaultValue: option })}</option>
                      ))}
                    </select>
                  </label>
                );
              }

              if (field === "institution_type") {
                return (
                  <label key={field} className="block text-sm font-semibold text-navy">
                    {label}
                    <select value={typeof value === "string" ? value : ""} onChange={(event) => setField(field, event.target.value as ProfileFields["institution_type"])} className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-3 py-2.5 text-sm">
                      <option value="">--</option>
                      {["government", "government_aided", "private", "municipal", "other"].map((option) => (
                        <option key={option} value={option}>{t(`profile.options.institution.${option}`, { defaultValue: option })}</option>
                      ))}
                    </select>
                  </label>
                );
              }

              return (
                <label key={field} className="block text-sm font-semibold text-navy">
                  {label}
                  <input
                    type={textFields.has(field) ? "text" : "number"}
                    value={typeof value === "string" || typeof value === "number" ? value : ""}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (textFields.has(field)) setField(field, raw);
                      else setField(field, raw === "" ? null : Number(raw));
                    }}
                    className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-3 py-2.5 text-sm"
                  />
                </label>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>{t("actions.cancel")}</Button>
            <Button type="button" onClick={submit} loading={saving} iconLeft={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}>
              {t("quickAnswer.save")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
