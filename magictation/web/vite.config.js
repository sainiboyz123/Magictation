import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset URLs relative so the app works behind Home Assistant ingress.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8099' } },
  build: { outDir: 'dist', sourcemap: false },
});
