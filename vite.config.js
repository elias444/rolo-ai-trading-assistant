import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Optional: If your index.html is not in the root, adjust root and publicDir
  // root: './',
  // publicDir: 'public',
  build: {
    outDir: 'dist', // Default output directory for builds
  },
});
