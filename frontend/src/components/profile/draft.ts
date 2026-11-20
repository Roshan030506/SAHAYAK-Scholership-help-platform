import type { ProfileFields } from "@/types/api";

/** String/boolean form state so partially typed numbers survive re-renders. */
export interface ProfileDraft {
  name: string;
  age: string;
  gender: "" | "female" | "male" | "other";
  state: string;
  district: string;
  category: "" | "General" | "OBC" | "SC" | "ST" | "EWS";
  annual_family_income: string;
  education_level:
    | ""
    | "class_8"
    | "class_9"
    | "class_10"
    | "class_11"
    | "class_12"
    | "undergraduate"
    | "postgraduate"
    | "diploma"
    | "iti";
  last_exam_percentage: string;
  course: string;
  institution_type: "" | "government" | "government_aided" | "private" | "municipal" | "other";
  disability_status: "" | "true" | "false";
  bank_account_present: "" | "true" | "false";
}

export const draftFieldOrder: Array<keyof ProfileDraft> = [
  "name",
  "age",
  "gender",
  "state",
  "district",
  "category",
  "annual_family_income",
  "education_level",
  "last_exam_percentage",
  "course",
  "institution_type",
  "disability_status",
  "bank_account_present",
];

export const emptyDraft: ProfileDraft = {
  name: "",
  age: "",
  gender: "",
  state: "",
  district: "",
  category: "",
  annual_family_income: "",
  education_level: "",
  last_exam_percentage: "",
  course: "",
  institution_type: "",
  disability_status: "",
  bank_account_present: "",
};

export function fromProfileFields(fields: ProfileFields | null | undefined): ProfileDraft {
  if (!fields) return { ...emptyDraft };
  return {
    name: fields.name ?? "",
    age: fields.age !== null && fields.age !== undefined ? String(fields.age) : "",
    gender: fields.gender ?? "",
    state: fields.state ?? "",
    district: fields.district ?? "",
    category: fields.category ?? "",
    annual_family_income:
      fields.annual_family_income !== null && fields.annual_family_income !== undefined
        ? String(fields.annual_family_income)
        : "",
    education_level: fields.education_level ?? "",
    last_exam_percentage:
      fields.last_exam_percentage !== null && fields.last_exam_percentage !== undefined
        ? String(fields.last_exam_percentage)
        : "",
    course: fields.course ?? "",
    institution_type: fields.institution_type ?? "",
    disability_status:
      fields.disability_status === null || fields.disability_status === undefined
        ? ""
        : fields.disability_status
          ? "true"
          : "false",
    bank_account_present:
      fields.bank_account_present === null || fields.bank_account_present === undefined
        ? ""
        : fields.bank_account_present
          ? "true"
          : "false",
  };
}

function parseOptionalInt(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalFloat(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toProfileFields(draft: ProfileDraft): ProfileFields {
  return {
    name: draft.name.trim() || null,
    age: parseOptionalInt(draft.age),
    gender: draft.gender || null,
    state: draft.state.trim() || null,
    district: draft.district.trim() || null,
    category: draft.category || null,
    annual_family_income: parseOptionalInt(draft.annual_family_income),
    education_level: draft.education_level || null,
    last_exam_percentage: parseOptionalFloat(draft.last_exam_percentage),
    course: draft.course.trim() || null,
    institution_type: draft.institution_type || null,
    disability_status: draft.disability_status === "" ? null : draft.disability_status === "true",
    bank_account_present:
      draft.bank_account_present === "" ? null : draft.bank_account_present === "true",
  };
}

export function draftCompleteness(draft: ProfileDraft): number {
  const filled = draftFieldOrder.filter((field) => draft[field] !== "").length;
  return filled / draftFieldOrder.length;
}

export function missingDraftFields(draft: ProfileDraft): Array<keyof ProfileDraft> {
  return draftFieldOrder.filter((field) => draft[field] === "");
}

export function validateDraft(draft: ProfileDraft): Partial<Record<keyof ProfileDraft, string>> {
  const errors: Partial<Record<keyof ProfileDraft, string>> = {};
  if (draft.age) {
    const age = parseOptionalInt(draft.age);
    if (age === null || age < 1 || age > 120) errors.age = "profile.errors.age";
  }
  if (draft.annual_family_income) {
    const income = parseOptionalInt(draft.annual_family_income);
    if (income === null || income < 0) errors.annual_family_income = "profile.errors.income";
  }
  if (draft.last_exam_percentage) {
    const percentage = parseOptionalFloat(draft.last_exam_percentage);
    if (percentage === null || percentage < 0 || percentage > 100) {
      errors.last_exam_percentage = "profile.errors.percentage";
    }
  }
  return errors;
}
