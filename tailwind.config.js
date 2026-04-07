const {
  colors: semanticColors,
  fontFamily,
  legacyTypography,
  typography,
} = require("./lib/design-system/tailwind.tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./assets/**/*.{js,jsx,ts,tsx}",
    "./constants/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily,
      fontSize: {
        ...typography,
        ...legacyTypography,
      },
      colors: semanticColors,
    },
  },
  plugins: [],
};
