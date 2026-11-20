import { useEffect, useState } from "react";

/** Subscribe to a CSS media query with an SSR-safe initial value. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** Detect a narrow/mobile viewport for simplified 3D scenes. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/** Detect the operating system reduced-motion preference. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
