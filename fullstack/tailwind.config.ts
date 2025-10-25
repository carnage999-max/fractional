import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b0f0d",
        foreground: "#e6ffe6",
        muted: "#0e1412",
        card: "#0f1613",
        border: "#1b2a22",
        accent: { DEFAULT: "#22c55e", 600: "#16a34a", 700: "#15803d", glow: "#6ee7b7" }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,197,94,0.35), 0 0 35px rgba(34,197,94,0.18)",
        innerglow: "inset 0 0 12px rgba(34,197,94,0.12)"
      },
      backgroundImage: { glow: "radial-gradient(60% 60% at 50% 10%, rgba(34,197,94,0.15), transparent 60%)" }
    }
  },
  plugins: []
};
export default config;
