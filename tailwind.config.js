/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        embrace: { DEFAULT: '#1f7bff', bright: '#3fd2ff', deep: '#0b3fa8', glow: '#2b8cff' },
        ban: { DEFAULT: '#ff2d3d', bright: '#ff5a4f', deep: '#a3101c', glow: '#ff3344' },
        gold: { DEFAULT: '#f7d774', deep: '#e0b13a' },
        ink: '#05060b',
        navy: '#0a1024',
        charcoal: '#15171f',
      },
      fontFamily: {
        display: ['"Archivo Black"', 'Impact', 'sans-serif'],
        condensed: ['Anton', 'Impact', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
