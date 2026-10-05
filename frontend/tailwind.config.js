export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#16845B",
          dark: "#116344",
          light: "#E8F5EE",
          hover: "#116344",
          soft: "#F0F8F3",
        },
        secondary: "#10B981",
        healthy: "#16845B",
        cream: "#F0F8F3",
        dark: "#17231D",
        light: "#F7F9F6",
        surface: "#FFFFFF",
        accent: {
          DEFAULT: "#F59E0B",
          light: "#FFF4DF",
        },
        brand: {
          bg: "#F7F9F6",
          surface: "#FFFFFF",
          text: "#17231D",
          muted: "#758278",
          border: "#E8EEE9",
        },
      },
      boxShadow: {
        '3d': '0 20px 40px -15px rgba(22, 132, 91, 0.1), 0 10px 20px -10px rgba(0,0,0,0.05)',
        'float': '0 30px 60px -20px rgba(22, 132, 91, 0.25)',
      },
    },
  },
  plugins: [],
}
