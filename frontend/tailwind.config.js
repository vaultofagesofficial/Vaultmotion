/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#e53e3e', 600: '#c53030', 700: '#9b2c2c' },
        dark: { 900: '#0f0f0f', 800: '#1a1a1a', 700: '#2a2a2a', 600: '#3a3a3a' },
        gold: { 500: '#d4a017', 600: '#b8860b' },
        parchment: '#e8e3d8',
        stone: '#6b6b6b'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};
