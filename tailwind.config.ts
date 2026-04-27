import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
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
      },
      boxShadow: {
        card: "0 1px 2px rgba(14, 40, 65, 0.04), 0 12px 32px -12px rgba(14, 40, 65, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
