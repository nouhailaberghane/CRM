import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e7f2eb",
          100: "#d3e8db",
          500: "#2f6f4e",
          600: "#245a3f",
          700: "#1d4a34",
        },
        ink: {
          700: "#1f2a24",
          500: "#5f6f66",
        },
      },
      fontFamily: {
        sans: ["Manrope", "sans-serif"],
        display: ["Instrument Serif", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(31, 42, 36, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
