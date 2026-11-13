import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' so the built dist/ folder works from any host path (Netlify Drop, GitHub Pages, a USB stick).
export default defineConfig({
  base: './',
  plugins: [react()],
});
