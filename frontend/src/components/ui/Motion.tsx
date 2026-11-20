import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";

/** Animated block that becomes instant for reduced-motion users. */
export function FadeIn({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  const storeReduced = useAppStore((state) => state.reduceMotion);
  const prefersReduced = useReducedMotion();
  const reduce = Boolean(storeReduced || prefersReduced);
  const Component = motion[as];

  return (
    <Component
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Component>
  );
}

/** Section heading with an eyebrow, title, and optional description. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" && "mx-auto max-w-2xl text-center", className)}>
      {eyebrow ? (
        <p className="mb-2 font-heading text-xs font-bold uppercase tracking-[0.22em] text-teal">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-heading text-[1.7rem] font-bold leading-tight tracking-tight text-navy sm:text-[2.1rem]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-[0.95rem] leading-relaxed text-navy-soft sm:text-base">{subtitle}</p>
      ) : null}
    </div>
  );
}
