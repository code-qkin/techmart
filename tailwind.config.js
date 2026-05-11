/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#E63946",
          light: "#FFE4E6",
          dark: "#C1121F",
        },
        background: "var(--color-background)",
        card: "var(--color-card)",
        navy: "var(--color-navy)",
        gray: {
          DEFAULT: "var(--color-gray)",
          text: "var(--color-gray)",
        },
        border: "var(--color-border)",
        success: "#10B981",
        warning: "#F59E0B",
        info: "#3B82F6",
      },
      fontFamily: {
        syne: ["Syne", "sans-serif"],
        dm: ["DM Sans", "sans-serif"],
      },
      borderRadius: {
        lg: "20px",
        md: "10px",
        sm: "8px",
      }
    },
  },
  plugins: [],
}
