import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensure esbuild correctly handles JSX files
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/, // Apply JSX loader to .js and .jsx files in src
    exclude: [], // No files to exclude
  },
  build: {
    outDir: 'dist', // Default output directory for builds
  },
});
