import { cn } from "@/lib/utils";

/**
 * Soft 2D garden illustration used as the WebGL/mobile/reduced-motion fallback.
 */
export function GardenFallback({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex h-full w-full items-center justify-center overflow-hidden", className)}>
      <svg
        viewBox="0 0 520 420"
        className="h-full w-full max-h-[34rem] object-contain"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="garden-sky" cx="50%" cy="42%" r="68%">
            <stop offset="0%" stopColor="#FFF7E6" />
            <stop offset="60%" stopColor="#F0FAF6" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </radialGradient>
          <radialGradient id="orb-glow" cx="42%" cy="36%" r="70%">
            <stop offset="0%" stopColor="#FEF3C7" />
            <stop offset="45%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>
          <linearGradient id="pillar-teal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5EEAD4" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id="pillar-saffron" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <linearGradient id="pillar-navy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#1E3A5F" />
          </linearGradient>
          <filter id="soft-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="16" stdDeviation="16" floodColor="#0B1B3A" floodOpacity="0.14" />
          </filter>
        </defs>

        <rect width="520" height="420" rx="36" fill="url(#garden-sky)" />

        <ellipse cx="260" cy="342" rx="190" ry="46" fill="#DDF3EB" />
        <ellipse cx="260" cy="342" rx="140" ry="30" fill="#C7EBDF" opacity="0.65" />
        <ellipse cx="260" cy="342" rx="88" ry="18" fill="#B3E4D7" opacity="0.5" />

        <g filter="url(#soft-shadow)">
          <g>
            <rect x="92" y="264" width="16" height="74" rx="8" fill="url(#pillar-teal)" />
            <circle cx="100" cy="258" r="13" fill="#99F6E4" />
          </g>
          <g>
            <rect x="168" y="226" width="18" height="112" rx="9" fill="url(#pillar-saffron)" />
            <circle cx="177" cy="218" r="15" fill="#FDE68A" />
          </g>
          <g>
            <rect x="252" y="204" width="20" height="134" rx="10" fill="url(#pillar-navy)" />
            <circle cx="262" cy="196" r="16" fill="#CBD5E1" />
          </g>
          <g>
            <rect x="338" y="244" width="18" height="94" rx="9" fill="url(#pillar-teal)" />
            <circle cx="347" cy="236" r="14" fill="#99F6E4" />
          </g>
          <g>
            <rect x="408" y="278" width="15" height="60" rx="7.5" fill="url(#pillar-saffron)" />
            <circle cx="415.5" cy="272" r="12" fill="#FDE68A" />
          </g>
        </g>

        <g className="animate-float">
          <ellipse cx="260" cy="148" rx="74" ry="18" fill="#0F766E" opacity="0.12" />
          <circle cx="260" cy="118" r="62" fill="url(#orb-glow)" filter="url(#soft-shadow)" />
          <circle cx="238" cy="96" r="15" fill="#FFFBEB" opacity="0.55" />
          <circle cx="260" cy="118" r="82" fill="none" stroke="#F59E0B" strokeOpacity="0.35" strokeWidth="2" />
          <circle cx="260" cy="118" r="102" fill="none" stroke="#0F766E" strokeOpacity="0.16" strokeWidth="2" strokeDasharray="5 9" />
        </g>

        <g opacity="0.95">
          <g transform="rotate(-10 120 130)">
            <rect x="78" y="92" width="84" height="58" rx="14" fill="#FFFFFF" stroke="#E2E8F0" />
            <rect x="92" y="106" width="34" height="6" rx="3" fill="#F59E0B" />
            <rect x="92" y="120" width="55" height="5" rx="2.5" fill="#CBD5E1" />
            <rect x="92" y="131" width="45" height="5" rx="2.5" fill="#E2E8F0" />
          </g>
          <g transform="rotate(8 400 112)">
            <rect x="352" y="76" width="94" height="64" rx="16" fill="#FFFFFF" stroke="#E2E8F0" />
            <rect x="368" y="92" width="38" height="6" rx="3" fill="#0F766E" />
            <rect x="368" y="107" width="60" height="5" rx="2.5" fill="#CBD5E1" />
            <rect x="368" y="118" width="48" height="5" rx="2.5" fill="#E2E8F0" />
          </g>
          <g transform="rotate(6 420 192)">
            <rect x="386" y="168" width="72" height="48" rx="12" fill="#FFFFFF" stroke="#E2E8F0" />
            <rect x="398" y="180" width="28" height="5" rx="2.5" fill="#F59E0B" />
            <rect x="398" y="192" width="44" height="4" rx="2" fill="#CBD5E1" />
          </g>
        </g>

        <g fill="#0F766E" opacity="0.35">
          <circle cx="90" cy="210" r="3" />
          <circle cx="438" cy="236" r="2.5" />
          <circle cx="398" cy="164" r="2" />
          <circle cx="126" cy="190" r="2" />
        </g>
      </svg>
    </div>
  );
}

/** Compact orb-only fallback for the profile voice panel. */
export function OrbFallback({
  listening,
  speaking,
  level,
  className,
}: {
  listening: boolean;
  speaking: boolean;
  level: number;
  className?: string;
}) {
  const active = listening || speaking;
  const scale = 1 + (listening ? level * 0.18 : 0);
  return (
    <div className={cn("relative flex h-full min-h-[15rem] items-center justify-center", className)}>
      <div
        className={cn(
          "absolute h-44 w-44 rounded-full bg-saffron/20 blur-2xl transition-transform duration-200 sm:h-52 sm:w-52",
          active && "animate-breathe",
        )}
        style={{ transform: `scale(${scale})` }}
        aria-hidden="true"
      />
      <div className="absolute h-56 w-56 rounded-full border border-teal/15" aria-hidden="true" />
      <div className="absolute h-44 w-44 rounded-full border border-saffron/20" aria-hidden="true" />
      <div
        className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-saffron to-amber-600 shadow-glow"
        style={{ transform: `scale(${scale})` }}
        aria-hidden="true"
      >
        <div className="absolute left-8 top-7 h-9 w-9 rounded-full bg-white/45 blur-sm" />
        <div className="absolute bottom-5 right-7 h-6 w-6 rounded-full bg-teal/40 blur-[2px]" />
        <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm" />
      </div>
      {active ? (
        <span className="absolute h-40 w-40 animate-pulse-ring rounded-full border-2 border-saffron/40" aria-hidden="true" />
      ) : null}
    </div>
  );
}
