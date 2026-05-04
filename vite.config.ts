import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: 'frontend/app',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/sessions': 'http://api:3000',
      '/sales': 'http://api:3000',
      '/reservations': 'http://api:3000'
    }
  }
});