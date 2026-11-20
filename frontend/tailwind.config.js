/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        saffron: {
          DEFAULT: "#F59E0B",
          light: "#FCD34D",
          dark: "#B45309",
        },
        teal: {
          DEFAULT: "#0F766E",
          light: "#5EEAD4",
          dark: "#134E4A",
        },
        navy: {
          DEFAULT: "#0B1B3A",
          light: "#1E3A5F",
          soft: "#334155",
        },
        cream: "#F8FAFC",
      },
      fontFamily: {
        heading: ["Poppins", "Noto Sans Devanagari", "system-ui", "sans-serif"],
        body: ["'Noto Sans'", "'Noto Sans Devanagari'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 60px rgba(245, 158, 11, 0.28)",
        "glow-teal": "0 0 60px rgba(15, 118, 110, 0.22)",
        glass: "0 24px 70px rgba(11, 27, 58, 0.12)",
      },
      backgroundImage: {
        "garden-sky":
          "radial-gradient(circle at 18% 18%, rgba(245, 158, 11, 0.24), transparent 34%), radial-gradient(circle at 82% 28%, rgba(94, 234, 212, 0.2), transparent 36%), linear-gradient(180deg, #FEFDF8 0%, #F8FAFC 48%, #F1F7F6 100%)",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.8)", opacity: "0.5" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        equalizer: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        breathe: "breathe 4.5s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        "pulse-ring": "pulseRing 2.2s ease-out infinite",
        equalizer: "equalizer 0.9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
