import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        plum: {
          dark: "#4F0433",
          DEFAULT: "#870052",
          light: "#EDDBE4",
        },
        grey: {
          DEFAULT: "#666666",
          light: "#F1F1F1",
        },
        kiwi: {
          orange: "#FF876F",
          "orange-light": "#FEEEEB",
          blue: "#4DB5BC",
          "blue-light": "#EDF4F4",
          "blue-dark": "#002C34",
          green: "#54B986",
          "green-light": "#C7ECDC",
          "green-dark": "#094334",
          red: "#B84145",
          yellow: "#FFC66D",
          "yellow-dark": "#F59A00",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-lora)", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.2" }],
        "display-lg": ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        display: ["2rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "display-sm": ["1.5rem", { lineHeight: "1.3" }],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.3s ease-out forwards",
        "scale-in": "scaleIn 0.28s ease-out forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
