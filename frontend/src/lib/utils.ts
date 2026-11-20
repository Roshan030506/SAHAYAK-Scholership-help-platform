import type { EligibilityResult, Language, ProfileFields } from "@/types/api";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

const localeMap: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
};

export function formatCurrency(value: number, language: Language = "en"): string {
  return new Intl.NumberFormat(localeMap[language], {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string, language: Language = "en"): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(localeMap[language], {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatNumber(value: number, language: Language = "en"): string {
  return new Intl.NumberFormat(localeMap[language]).format(value);
}

export function calculateCompleteness(fields: ProfileFields): number {
  const values = Object.values(fields);
  if (!values.length) return 0;
  const filled = values.filter((value) => value !== null && value !== undefined && value !== "").length;
  return filled / 13;
}

export function statusTone(status: EligibilityResult["status"]): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  if (status === "eligible") {
    return {
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
    };
  }
  if (status === "likely") {
    return {
      bg: "bg-amber-50",
      text: "text-amber-900",
      border: "border-amber-200",
      dot: "bg-amber-500",
    };
  }
  return {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
