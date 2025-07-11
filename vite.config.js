// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // This explicitly tells the plugin to use Babel for JSX transformation
      // which can sometimes help with parsing issues.
      // It also ensures that .js files containing JSX are correctly processed.
      jsxRuntime: 'automatic', // Or 'classic' if you prefer, 'automatic' is modern React
      // If you had .js files containing JSX, you might need:
      // include: '**/*.{js,jsx,ts,tsx}', 
    }),
  ],
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
});
