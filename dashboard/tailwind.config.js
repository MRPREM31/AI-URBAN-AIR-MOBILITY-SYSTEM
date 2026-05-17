/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          blue: '#00f2ff',
          pink: '#ff00ff',
          dark: '#0a0a0a',
          glass: 'rgba(255, 255, 255, 0.05)',
        }
      }
    },
  },
  plugins: [],
}

