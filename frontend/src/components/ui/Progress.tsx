import { cn } from "@/lib/utils";

export function Progress({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-center justify-between text-xs font-medium text-navy-soft">
          <span>{label}</span>
          <span className="tabular-nums text-navy">{percent}%</span>
        </div>
      ) : null}
      <div
        className="h-2 overflow-hidden rounded-full bg-navy/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label ?? "Progress"}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-saffron via-amber-400 to-teal transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
