export type Language = "en" | "hi" | "mr";

export interface LocalizedText {
  en: string;
  hi: string;
  mr: string;
}

export type RuleOperator =
  | "eq"
  | "in"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "between"
  | "exists"
  | "contains_any";

export interface SchemeRule {
  field: string;
  operator: RuleOperator;
  value: unknown;
  label: LocalizedText;
}

export interface RequiredDocument {
  type: string;
  label: LocalizedText;
}

export interface RightItem {
  title: LocalizedText;
  detail: LocalizedText;
}

export interface GrievanceContact {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface Scheme {
  id: string;
  name: LocalizedText;
  short_name: LocalizedText;
  authority: LocalizedText;
  description: LocalizedText;
  benefit_amount_per_year: number;
  deadline: string;
  rules: SchemeRule[];
  required_documents: RequiredDocument[];
  rights: RightItem[];
  grievance_contact: GrievanceContact;
  source_url: string;
  apply_url: string;
  tags: string[];
}

export type PortalGroup = "central" | "state" | "csr" | "discovery";

export interface Portal {
  id: string;
  name: LocalizedText;
  short_name: LocalizedText;
  authority: LocalizedText;
  description: LocalizedText;
  url: string;
  group: PortalGroup;
  tags: string[];
}

export interface PortalListResponse {
  portals: Portal[];
  count: number;
}

export interface ProfileFields {
  name?: string | null;
  age?: number | null;
  gender?: "female" | "male" | "other" | null;
  state?: string | null;
  district?: string | null;
  category?: "General" | "OBC" | "SC" | "ST" | "EWS" | null;
  annual_family_income?: number | null;
  education_level?:
    | "class_8"
    | "class_9"
    | "class_10"
    | "class_11"
    | "class_12"
    | "undergraduate"
    | "postgraduate"
    | "diploma"
    | "iti"
    | null;
  last_exam_percentage?: number | null;
  course?: string | null;
  institution_type?: "government" | "government_aided" | "private" | "municipal" | "other" | null;
  disability_status?: boolean | null;
  bank_account_present?: boolean | null;
}

export interface SessionResponse {
  user_id: string;
  language: Language;
  created_at: string;
}

export interface ProfileResponse {
  user_id: string;
  language: Language;
  fields: ProfileFields;
  updated_at: string | null;
  completeness: number;
  missing_fields: string[];
}

export interface FromTextResponse {
  updates: Partial<ProfileFields>;
  confidence: Record<string, number>;
  fields: ProfileFields;
  missing_fields: string[];
  message: string;
  follow_up_questions: string[];
  provider: string;
}

export type EligibilityStatus = "eligible" | "likely" | "not_eligible";
export type RuleOutcome = "passed" | "failed" | "unknown";

export interface RuleResult {
  field: string;
  operator: RuleOperator;
  expected: unknown;
  actual: unknown;
  outcome: RuleOutcome;
  reason_key: string;
  reason: string;
}

export interface RequiredDocumentResult {
  type: string;
  label: string;
}

export interface EligibilityResult {
  scheme_id: string;
  scheme_name: string;
  short_name: string;
  authority: string;
  benefit_amount_per_year: number;
  deadline: string;
  status: EligibilityStatus;
  status_reason: string;
  status_summary: string;
  passed_rules: RuleResult[];
  failed_rules: RuleResult[];
  unknown_rules: RuleResult[];
  missing_fields: string[];
  missing_field_labels: string[];
  missing_documents: string[];
  missing_document_labels: string[];
  required_documents: RequiredDocumentResult[];
  total_rules: number;
  passed_count: number;
  failed_count: number;
  unknown_count: number;
  source_url: string;
  apply_url: string;
  rank: number;
}

export interface MatchResponse {
  results: EligibilityResult[];
  language: Language;
  profile_fields: ProfileFields;
  available_documents: string[];
  generated_at: string;
  disclaimer: string;
}

export interface SchemeListResponse {
  schemes: Scheme[];
  count: number;
}

export interface SchemeDetailResponse {
  scheme: Scheme;
}

export interface DeleteMeResponse {
  deleted: Record<string, number>;
  message: string;
}

export interface HealthResponse {
  status: "ok";
  version: string;
  llm_provider: string;
  schemes_loaded: number;
}

export interface ApiErrorBody {
  detail?: string | { code?: string; message?: string };
  error?: { code?: string; message?: string };
}
