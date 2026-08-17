import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Для нативных сборок (Capacitor/Electron) используем относительный base './',
// чтобы ассеты загружались из file:// (APK) и локальных файлов (Electron).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
