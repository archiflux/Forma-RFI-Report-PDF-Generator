import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Holdpoint is square: no rounding anywhere except people and live state
    // (avatars, pulsing dots, spinners), which keep rounded-full.
    borderRadius: {
      none: "0",
      sm: "0",
      DEFAULT: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "9999px",
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--brand-primary)",
          primary: "var(--brand-primary)",
          secondary: "var(--brand-secondary)",
          accent: "var(--brand-accent)",
          ink: "var(--brand-ink)",
          "ink-soft": "var(--brand-ink-soft)",
          muted: "var(--brand-muted)",
          surface: "var(--brand-surface)",
          canvas: "var(--brand-canvas)",
          border: "var(--brand-border)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        wordmark: ["var(--font-chakra-petch)", "var(--font-sans)", "sans-serif"],
        display: ["var(--font-chakra-petch)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        card: "var(--shadow-sm)",
        "hp-sm": "var(--shadow-sm)",
        "hp-md": "var(--shadow-md)",
        "hp-lg": "var(--shadow-lg)",
        "hp-xl": "var(--shadow-xl)",
      },
    },
  },
  plugins: [],
};

export default config;
