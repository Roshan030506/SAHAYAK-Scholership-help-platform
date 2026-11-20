import type { ProfileFields } from "@/types/api";

/**
 * Fictional demo student used by the sample-profile buttons.
 *
 * These values deliberately satisfy four of the five bundled schemes so the
 * product demo shows a realistic spread: several wins and one clear miss.
 */
export const sampleProfileFields: ProfileFields = {
  name: "Riya Patil",
  age: 19,
  gender: "female",
  state: "Maharashtra",
  district: "Pune",
  category: "SC",
  annual_family_income: 200000,
  education_level: "undergraduate",
  last_exam_percentage: 82.4,
  course: "B.Sc / Science",
  institution_type: "government",
  disability_status: true,
  bank_account_present: true,
};

export const sampleProfileSentence =
  "My name is Riya Patil. I am 19 years old and I am female, from Pune, Maharashtra. " +
  "I belong to the SC category. My family income is 2 lakh. I am studying in the first year " +
  "of a B.Sc undergraduate degree at a government college. I scored 82.4 percent in my last exam. " +
  "I have a disability and I have a bank account.";
