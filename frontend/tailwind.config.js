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
          DEFAULT: '#0C831F', // Blinkit/Nexus Green
          light: '#EDFAF3',
          hover: '#096C18'
        },
        secondary: {
          DEFAULT: '#F2F2F7', // Gray background
          text: '#686B78'     // Subtle text
        },
        brand: {
          yellow: '#FCE74C', // Blinkit highlight
          red: '#E74C3C'
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
