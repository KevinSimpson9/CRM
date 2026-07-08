import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0b",
        panel: "#131316",
        raised: "#1a1a1f",
        edge: "#26262b",
        ink: "#e7e7ea",
        muted: "#8b8b94",
        teal: { DEFAULT: "#2dd4bf", dim: "#134e4a" },
        gold: { DEFAULT: "#d4a94e", dim: "#4a3a17" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
