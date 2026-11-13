import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds ONE self-contained HTML file (offline/demo backup — double-click to open, no server needed).
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-offline', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
