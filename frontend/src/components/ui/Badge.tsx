import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn, statusTone } from "@/lib/utils";
import type { EligibilityStatus } from "@/types/api";

export function StatusBadge({
  status,
  className,
}: {
  status: EligibilityStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        tone.bg,
        tone.text,
        tone.border,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", tone.dot)} aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}

export function Pill({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "saffron" | "teal" | "white";
}) {
  const tones = {
    neutral: "border-navy/10 bg-navy/[0.04] text-navy-soft",
    saffron: "border-saffron/25 bg-amber-50 text-amber-900",
    teal: "border-teal/20 bg-teal-50 text-teal-dark",
    white: "border-white/20 bg-white/10 text-white/90",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
