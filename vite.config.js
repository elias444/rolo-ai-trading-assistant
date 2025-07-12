// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  base: '/',
  build: {
    rollupOptions: {
      input: 'public/index.html',
    },
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/.netlify\/functions/, ''),
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});
