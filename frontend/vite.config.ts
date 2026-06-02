import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration.
 * In development, all /api requests are proxied to the Express backend
 * running on port 3001. In production, the backend URL is set via
 * the VITE_API_URL environment variable.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
