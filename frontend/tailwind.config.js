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
        border: "hsl(215 28% 17%)",
        background: "hsl(220 33% 98%)",
        foreground: "hsl(224 71.4% 4.1%)",
        primary: {
          DEFAULT: "hsl(220 90% 40%)",
          foreground: "hsl(0 0% 100%)",
        },
        accent: {
          DEFAULT: "hsl(250 80% 50%)",
          foreground: "hsl(0 0% 100%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(224 71.4% 4.1%)",
        },
      },
    },
  },
  plugins: [],
}
