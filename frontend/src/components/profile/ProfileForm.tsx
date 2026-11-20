import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, Save, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { draftCompleteness, missingDraftFields } from "@/components/profile/draft";
import type { ProfileDraft } from "@/components/profile/draft";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-navy/10 bg-white px-3.5 py-2.5 text-sm font-medium text-navy shadow-sm outline-none transition placeholder:text-navy-soft/45 focus:border-teal/60 focus:ring-4 focus:ring-teal/10 aria-[invalid=true]:border-red-300 aria-[invalid=true]:focus:border-red-400 aria-[invalid=true]:focus:ring-red-100";

const labelClass = "mb-1.5 block font-heading text-[0.78rem] font-semibold text-navy";

function Field({
  field,
  error,
  hint,
  children,
  className,
}: {
  field: keyof ProfileDraft;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const id = `profile-${field}`;
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className={labelClass}>
        {t(`profile.fields.${field}`)}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[0.7rem] leading-snug text-navy-soft/70">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-[0.7rem] font-medium text-red-700">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  field,
  value,
  onChange,
  error,
  children,
}: {
  field: keyof ProfileDraft;
  value: string;
  onChange: (field: keyof ProfileDraft, value: string) => void;
  error?: string;
  children: ReactNode;
}) {
  const id = `profile-${field}`;
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        className={cn(inputClass, "cursor-pointer appearance-none pr-10")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-soft/60"
        aria-hidden="true"
      />
    </div>
  );
}

interface ProfileFormProps {
  draft: ProfileDraft;
  errors: Partial<Record<keyof ProfileDraft, string>>;
  saving: "save" | "match" | null;
  onChange: (field: keyof ProfileDraft, value: string) => void;
  onSave: (match: boolean) => void;
  onUseSample: () => void;
}

/** All thirteen FR-1 profile fields with inline validation and saving states. */
export function ProfileForm({
  draft,
  errors,
  saving,
  onChange,
  onSave,
  onUseSample,
}: ProfileFormProps) {
  const { t } = useTranslation();
  const completeness = draftCompleteness(draft);
  const missing = missingDraftFields(draft);
  const isSaving = saving !== null;

  return (
    <Card padding="lg" className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-saffron/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold tracking-tight text-navy sm:text-2xl">
              {t("profile.form.title")}
            </h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-navy-soft">
              {t("profile.form.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onUseSample}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-teal/20 bg-teal-50/70 px-3 py-1.5 font-heading text-xs font-semibold text-teal-dark transition hover:border-teal/40 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t("actions.useSample")}
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-navy/[0.06] bg-navy/[0.025] px-4 py-3">
          <Progress value={completeness} label={t("profile.form.completeness")} />
          {missing.length ? (
            <p className="mt-2 text-[0.72rem] leading-relaxed text-navy-soft">
              {t("profile.form.missing", {
                fields: missing.map((field) => t(`profile.fields.${field}`)).join(", "),
              })}
            </p>
          ) : (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("profile.form.allSet")}
            </p>
          )}
        </div>

        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(true);
          }}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              field="name"
              error={errors.name}
              className="sm:col-span-2"
            >
              <input
                id="profile-name"
                type="text"
                autoComplete="name"
                maxLength={120}
                value={draft.name}
                onChange={(event) => onChange("name", event.target.value)}
                className={inputClass}
                placeholder="Riya Patil"
              />
            </Field>

            <Field field="age" error={errors.age}>
              <input
                id="profile-age"
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                value={draft.age}
                onChange={(event) => onChange("age", event.target.value)}
                className={inputClass}
                placeholder="19"
                aria-invalid={Boolean(errors.age)}
                aria-describedby={errors.age ? "profile-age-error" : undefined}
              />
            </Field>

            <Field field="gender" error={errors.gender}>
              <SelectField field="gender" value={draft.gender} onChange={onChange} error={errors.gender}>
                <option value="">{t("profile.form.select")}</option>
                <option value="female">{t("profile.options.gender.female")}</option>
                <option value="male">{t("profile.options.gender.male")}</option>
                <option value="other">{t("profile.options.gender.other")}</option>
              </SelectField>
            </Field>

            <Field field="state" error={errors.state}>
              <input
                id="profile-state"
                type="text"
                autoComplete="address-level1"
                list="indian-states"
                maxLength={80}
                value={draft.state}
                onChange={(event) => onChange("state", event.target.value)}
                className={inputClass}
                placeholder="Maharashtra"
              />
            </Field>

            <Field field="district" error={errors.district}>
              <input
                id="profile-district"
                type="text"
                autoComplete="address-level2"
                maxLength={80}
                value={draft.district}
                onChange={(event) => onChange("district", event.target.value)}
                className={inputClass}
                placeholder="Pune"
              />
            </Field>

            <Field field="category" error={errors.category}>
              <SelectField
                field="category"
                value={draft.category}
                onChange={onChange}
                error={errors.category}
              >
                <option value="">{t("profile.form.select")}</option>
                <option value="General">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="EWS">EWS</option>
              </SelectField>
            </Field>

            <Field field="annual_family_income" error={errors.annual_family_income}>
              <input
                id="profile-annual_family_income"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={draft.annual_family_income}
                onChange={(event) => onChange("annual_family_income", event.target.value)}
                className={inputClass}
                placeholder="200000"
                aria-invalid={Boolean(errors.annual_family_income)}
                aria-describedby={
                  errors.annual_family_income ? "profile-annual_family_income-error" : undefined
                }
              />
            </Field>

            <Field field="education_level" error={errors.education_level}>
              <SelectField
                field="education_level"
                value={draft.education_level}
                onChange={onChange}
                error={errors.education_level}
              >
                <option value="">{t("profile.form.select")}</option>
                <option value="class_8">{t("profile.options.education.class_8")}</option>
                <option value="class_9">{t("profile.options.education.class_9")}</option>
                <option value="class_10">{t("profile.options.education.class_10")}</option>
                <option value="class_11">{t("profile.options.education.class_11")}</option>
                <option value="class_12">{t("profile.options.education.class_12")}</option>
                <option value="undergraduate">{t("profile.options.education.undergraduate")}</option>
                <option value="postgraduate">{t("profile.options.education.postgraduate")}</option>
                <option value="diploma">{t("profile.options.education.diploma")}</option>
                <option value="iti">{t("profile.options.education.iti")}</option>
              </SelectField>
            </Field>

            <Field field="last_exam_percentage" error={errors.last_exam_percentage}>
              <input
                id="profile-last_exam_percentage"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.1}
                value={draft.last_exam_percentage}
                onChange={(event) => onChange("last_exam_percentage", event.target.value)}
                className={inputClass}
                placeholder="82.4"
                aria-invalid={Boolean(errors.last_exam_percentage)}
                aria-describedby={
                  errors.last_exam_percentage ? "profile-last_exam_percentage-error" : undefined
                }
              />
            </Field>

            <Field field="course" error={errors.course}>
              <input
                id="profile-course"
                type="text"
                maxLength={120}
                value={draft.course}
                onChange={(event) => onChange("course", event.target.value)}
                className={inputClass}
                placeholder="B.Sc / Science"
              />
            </Field>

            <Field field="institution_type" error={errors.institution_type}>
              <SelectField
                field="institution_type"
                value={draft.institution_type}
                onChange={onChange}
                error={errors.institution_type}
              >
                <option value="">{t("profile.form.select")}</option>
                <option value="government">{t("profile.options.institution.government")}</option>
                <option value="government_aided">
                  {t("profile.options.institution.government_aided")}
                </option>
                <option value="private">{t("profile.options.institution.private")}</option>
                <option value="municipal">{t("profile.options.institution.municipal")}</option>
                <option value="other">{t("profile.options.institution.other")}</option>
              </SelectField>
            </Field>

            <Field field="disability_status" error={errors.disability_status}>
              <SelectField
                field="disability_status"
                value={draft.disability_status}
                onChange={onChange}
                error={errors.disability_status}
              >
                <option value="">{t("profile.form.unknown")}</option>
                <option value="true">{t("profile.form.yes")}</option>
                <option value="false">{t("profile.form.no")}</option>
              </SelectField>
            </Field>

            <Field field="bank_account_present" error={errors.bank_account_present}>
              <SelectField
                field="bank_account_present"
                value={draft.bank_account_present}
                onChange={onChange}
                error={errors.bank_account_present}
              >
                <option value="">{t("profile.form.unknown")}</option>
                <option value="true">{t("profile.form.yes")}</option>
                <option value="false">{t("profile.form.no")}</option>
              </SelectField>
            </Field>
          </div>

          <datalist id="indian-states">
            {[
              "Andhra Pradesh",
              "Arunachal Pradesh",
              "Assam",
              "Bihar",
              "Chhattisgarh",
              "Delhi",
              "Goa",
              "Gujarat",
              "Haryana",
              "Himachal Pradesh",
              "Jharkhand",
              "Karnataka",
              "Kerala",
              "Madhya Pradesh",
              "Maharashtra",
              "Manipur",
              "Meghalaya",
              "Mizoram",
              "Nagaland",
              "Odisha",
              "Punjab",
              "Rajasthan",
              "Sikkim",
              "Tamil Nadu",
              "Telangana",
              "Tripura",
              "Uttar Pradesh",
              "Uttarakhand",
              "West Bengal",
            ].map((state) => (
              <option key={state} value={state} />
            ))}
          </datalist>

          <div className="flex flex-col-reverse gap-2 border-t border-navy/5 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onSave(false)}
              loading={saving === "save"}
              disabled={isSaving}
              iconLeft={<Save className="h-4 w-4" aria-hidden="true" />}
            >
              {saving === "save" ? t("actions.saving") : t("actions.save")}
            </Button>
            <Button
              type="submit"
              loading={saving === "match"}
              disabled={isSaving}
              iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
            >
              {saving === "match" ? t("actions.saving") : t("actions.saveAndMatch")}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
