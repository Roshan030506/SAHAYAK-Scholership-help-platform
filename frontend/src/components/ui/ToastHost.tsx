import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { useToastStore } from "@/store/toast";
import { cn } from "@/lib/utils";

const icons = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

const tones = {
  info: "border-teal/20 bg-white text-navy",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-red-200 bg-red-50 text-red-950",
};

const iconTones = {
  info: "text-teal",
  success: "text-emerald-600",
  error: "text-red-600",
};

export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => {
        const Icon = icons[toast.tone];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-2xl border px-4 py-3 shadow-glass",
              tones[toast.tone],
            )}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconTones[toast.tone])} aria-hidden="true" />
            <p className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-full p-1 text-current/60 transition hover:bg-current/10 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
