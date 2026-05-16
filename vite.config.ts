import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  cacheDir: '.vite',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
