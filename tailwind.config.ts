import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hitachi: {
          DEFAULT: "#E60027",
          dark: "#B5001E",
          light: "#FF1A3D",
          ink: "#0B0F19",
          slate: "#1A1F2E",
        },
        pitch: {
          50: "#f5faf2",
          100: "#e6f3df",
          500: "#3a7d2d",
          700: "#27581f",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
