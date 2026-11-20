import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";

import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import { useToastStore } from "@/store/toast";
import type { Language } from "@/types/api";

interface ReadAloudButtonProps {
  text: string;
  language: Language;
  label?: string;
  stopLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "onDark";
  size?: "sm" | "md";
  iconOnly?: boolean;
  className?: string;
}

const variants = {
  primary:
    "bg-navy text-white shadow-sm hover:bg-navy-light focus-visible:ring-saffron/40",
  secondary:
    "border border-teal/20 bg-white/85 text-teal-dark shadow-sm backdrop-blur hover:border-teal/40 hover:bg-teal-50/80 focus-visible:ring-saffron/40",
  ghost: "text-navy-soft hover:bg-navy/5 hover:text-navy focus-visible:ring-saffron/30",
  onDark:
    "border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/15 focus-visible:ring-saffron/40",
};

/** Read a page summary aloud with the shared speech synthesis layer. */
export function ReadAloudButton({
  text,
  language,
  label,
  stopLabel,
  variant = "secondary",
  size = "md",
  iconOnly = false,
  className,
}: ReadAloudButtonProps) {
  const { t } = useTranslation();
  const { supported, speaking, speak, cancel } = useSpeechSynthesis();
  const rate = useAppStore((state) => state.assistantRate);
  const pushToast = useToastStore((state) => state.push);

  function toggle() {
    if (speaking) {
      cancel();
      return;
    }
    if (!supported) {
      pushToast(t("toasts.speechUnsupported"), "info");
      return;
    }
    speak(text, language, {
      rate,
      onError: () => pushToast(t("toasts.voiceError"), "error"),
    });
  }

  const accessibleLabel = speaking
    ? (stopLabel ?? t("actions.stop"))
    : (label ?? t("actions.listen"));

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!supported}
      aria-pressed={speaking}
      aria-label={accessibleLabel}
      title={supported ? accessibleLabel : t("toasts.speechUnsupported")}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-heading font-semibold tracking-tight transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        iconOnly ? "h-9 w-9" : size === "sm" ? "min-h-[2.35rem] px-3.5 py-2 text-sm" : "min-h-[2.9rem] px-5 py-2.5 text-[0.95rem]",
        speaking && "ring-2 ring-saffron/40",
        className,
      )}
    >
      {speaking ? (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      )}
      {iconOnly ? null : <span>{accessibleLabel}</span>}
    </button>
  );
}
