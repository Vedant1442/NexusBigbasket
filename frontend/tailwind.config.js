export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#84c225', // BigBasket Green
          light: '#f4fbe9',
          hover: '#6da31d'
        },
        secondary: {
          DEFAULT: '#F2F2F7', // Gray background
          text: '#686B78'     // Subtle text
        },
        brand: {
          yellow: '#ffcb05', // Highlights
          red: '#ed1c24'     // BigBasket Red
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 15px rgba(0,0,0,0.05)',
        'float': '0 8px 30px rgba(0,0,0,0.1)',
      }
    },
  },
  plugins: [],
}
