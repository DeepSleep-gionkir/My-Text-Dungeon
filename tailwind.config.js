/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0c",
        surface: "#121212",
        primary: "#ffd700",
        secondary: "#5b21b6",
        accent: "#991b1b",
        text: {
          main: "#f5f5f5",
          muted: "#a3a3a3",
        },
      },
      fontFamily: {
        display: ["Cinzel", "serif"],
        serif: ["Noto Serif KR", "serif"],
        sans: ["IBM Plex Sans KR", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Courier New", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};

