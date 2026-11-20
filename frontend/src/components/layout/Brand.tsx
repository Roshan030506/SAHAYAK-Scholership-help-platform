import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/** Sprout-in-a-circle mark used in the header and footer. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-saffron to-amber-500 text-white shadow-[0_10px_24px_rgba(245,158,11,0.35)]",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none">
        <path
          d="M16 26V15.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M16 16c-4.8 0-7.5-2.6-7.5-7.2 4.9 0 7.5 2.7 7.5 7.2Z"
          fill="currentColor"
          opacity="0.95"
        />
        <path
          d="M16 13.4c0-4.4 2.7-7 7.4-7 0 4.5-2.7 7-7.4 7Z"
          fill="currentColor"
          opacity="0.8"
        />
        <path
          d="M10.5 26h11"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Brand({ onClick }: { onClick?: () => void }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
    >
      <BrandMark className="transition-transform duration-300 group-hover:-rotate-6" />
      <span className="leading-tight">
        <span className="block font-heading text-[1.2rem] font-bold tracking-tight text-navy">
          Sahayak
        </span>
        <span className="block text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-teal">
          {t("brand.subtitle")}
        </span>
      </span>
    </Link>
  );
}
