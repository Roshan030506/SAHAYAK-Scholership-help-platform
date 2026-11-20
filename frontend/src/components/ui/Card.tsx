import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: "default" | "glass" | "warm" | "dark";
  padding?: "none" | "sm" | "md" | "lg";
}

const tones = {
  default: "border-navy/10 bg-white shadow-glass",
  glass: "border-white/60 bg-white/72 shadow-glass backdrop-blur-xl",
  warm: "border-saffron/20 bg-gradient-to-br from-amber-50/90 via-white to-teal-50/60 shadow-[0_20px_60px_rgba(180,83,9,0.08)]",
  dark: "border-white/10 bg-navy text-white shadow-[0_24px_70px_rgba(11,27,58,0.35)]",
};

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8 lg:p-10",
};

export function Card({ children, className, tone = "default", padding = "md", ...rest }: CardProps) {
  return (
    <div
      className={cn("rounded-3xl border", tones[tone], paddings[padding], className)}
      {...rest}
    >
      {children}
    </div>
  );
}
