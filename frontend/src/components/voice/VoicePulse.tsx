import { Mic, Sparkles, Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type VoicePulseState = "idle" | "listening" | "thinking" | "speaking";

interface VoicePulseProps {
  state: VoicePulseState;
  level?: number;
  size?: "sm" | "md";
  className?: string;
}

const sizeMap = {
  sm: {
    frame: "h-16 w-16",
    glow: "h-14 w-14",
    core: "h-11 w-11",
    icon: "h-4 w-4",
    ring: "h-20 w-20",
  },
  md: {
    frame: "h-24 w-24",
    glow: "h-20 w-20",
    core: "h-16 w-16",
    icon: "h-5 w-5",
    ring: "h-28 w-28",
  },
};

/**
 * Compact CSS voice orb used in the assistant panel and page controls.
 *
 * The four states remain legible without animation or WebGL: the icon and
 * status text always communicate what the assistant is doing.
 */
export function VoicePulse({ state, level = 0, size = "md", className }: VoicePulseProps) {
  const dimensions = sizeMap[size];
  const active = state === "listening" || state === "speaking";
  const scale = state === "listening" ? 1 + level * 0.22 : 1;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        dimensions.frame,
        className,
      )}
      aria-hidden="true"
      data-voice-state={state}
    >
      <span
        className={cn(
          "absolute rounded-full blur-2xl transition-transform duration-150",
          dimensions.glow,
          state === "listening"
            ? "bg-saffron/45"
            : state === "speaking"
              ? "bg-teal-light/40"
              : state === "thinking"
                ? "bg-teal/30"
                : "bg-saffron/25",
          active && "animate-breathe",
        )}
        style={{ transform: `scale(${scale})` }}
      />
      <span
        className={cn(
          "absolute rounded-full border",
          dimensions.ring,
          state === "listening"
            ? "animate-pulse-ring border-saffron/45"
            : state === "speaking"
              ? "border-teal-light/45"
              : "border-white/20",
        )}
      />
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full border border-white/30 shadow-glow transition-transform duration-150",
          dimensions.core,
          state === "listening"
            ? "bg-gradient-to-br from-amber-200 via-saffron to-amber-600"
            : state === "speaking"
              ? "bg-gradient-to-br from-teal-light via-teal to-teal-dark"
              : state === "thinking"
                ? "bg-gradient-to-br from-teal-light/80 via-teal to-navy"
                : "bg-gradient-to-br from-amber-100 via-saffron to-amber-600",
        )}
        style={{ transform: `scale(${scale})` }}
      >
        {state === "speaking" ? (
          <span className="flex items-end gap-0.5">
            {[0, 1, 2, 3].map((bar) => (
              <span
                key={bar}
                className="w-0.5 animate-equalizer rounded-full bg-white/90"
                style={{
                  height: size === "sm" ? "0.8rem" : "1.1rem",
                  animationDelay: `${bar * 90}ms`,
                }}
              />
            ))}
          </span>
        ) : state === "thinking" ? (
          <Sparkles className={cn("animate-pulse text-white", dimensions.icon)} />
        ) : state === "listening" ? (
          <Mic className={cn("text-navy", dimensions.icon)} />
        ) : (
          <Volume2 className={cn("text-white/90", dimensions.icon)} />
        )}
      </span>
      {state === "thinking" ? (
        <span
          className={cn(
            "absolute animate-spin rounded-full border-2 border-transparent border-t-teal-light/80",
            dimensions.ring,
          )}
        />
      ) : null}
    </div>
  );
}
