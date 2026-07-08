import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8787,
    strictPort: true,
    // Never watch the Rust build dir — cargo writes .dll/.pdb there constantly
    // during `tauri dev`, and watching them crashes Vite with EBUSY.
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path,
      },
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  optimizeDeps: {
    include: ['@tauri-apps/api'],
  },
});