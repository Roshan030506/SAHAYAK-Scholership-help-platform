import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "saffron" | "onDark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-heading font-semibold tracking-tight transition-all duration-200 " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/40 disabled:cursor-not-allowed disabled:opacity-55 " +
  "active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-navy text-white shadow-[0_14px_30px_rgba(11,27,58,0.22)] hover:bg-navy-light hover:shadow-[0_18px_36px_rgba(11,27,58,0.28)]",
  secondary:
    "border border-teal/20 bg-white/85 text-teal-dark shadow-sm backdrop-blur hover:border-teal/40 hover:bg-teal-50/80",
  ghost: "text-navy-soft hover:bg-navy/5 hover:text-navy",
  danger:
    "bg-red-600 text-white shadow-[0_14px_30px_rgba(185,28,28,0.22)] hover:bg-red-700",
  saffron:
    "bg-saffron text-navy shadow-[0_14px_30px_rgba(245,158,11,0.24)] hover:bg-saffron-light",
  onDark:
    "border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/15",
};

const sizes: Record<Size, string> = {
  sm: "min-h-[2.35rem] px-3.5 py-2 text-sm",
  md: "min-h-[2.9rem] px-5 py-2.5 text-[0.95rem]",
  lg: "min-h-[3.35rem] px-7 py-3 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra?: string): string {
  return cn(base, variants[variant], sizes[size], extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    iconLeft,
    iconRight,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : iconLeft}
      <span>{children}</span>
      {!loading && iconRight}
    </button>
  );
});

interface LinkButtonProps {
  to: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export function LinkButton({
  to,
  children,
  variant = "primary",
  size = "md",
  className,
  iconLeft,
  iconRight,
}: LinkButtonProps) {
  return (
    <Link to={to} className={buttonClasses(variant, size, className)}>
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </Link>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-r-transparent",
        className ?? "h-5 w-5",
      )}
      aria-hidden="true"
    />
  );
}
