// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // This tells Vite where your main HTML entry point is.
    // Since index.html is in the 'public' folder, we specify it here.
    rollupOptions: {
      input: 'public/index.html',
    },
    // The output directory for the built files. This should match 'publish' in netlify.toml
    outDir: 'dist',
  },
  // For local development, if you need to proxy Netlify functions
  // This is typically not needed for Netlify deployment itself, but useful locally.
  server: {
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:9000', // Default Netlify Dev functions port
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/.netlify\/functions/, ''),
      },
    },
  },
});
