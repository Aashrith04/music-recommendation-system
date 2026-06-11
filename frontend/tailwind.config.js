/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0B0D19',      // Deep space violet-black
          card: '#15192E',      // Dark slate card background
          accent: '#A855F7',    // Vibrant purple/violet
          neon: '#10B981',      // Neon emerald green
          hover: '#242B4C',     // Card hover state
          textMuted: '#94A3B8', // Muted slate text
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}
