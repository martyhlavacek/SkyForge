import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Multi-page setup (Sprint 8.1): the game at / and the level editor at /editor.html and the Game Design Studio at
 * /studio.html, sharing all of src/ (schemas, ContentRegistry, etc.).
 * React is only pulled into the editor bundle.
 */
export default defineConfig({
  // For project-page hosting set base to '/<repo>/' via VITE_BASE at build time.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    manifest: true,
    chunkSizeWarningLimit: 1650,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
        studio: resolve(__dirname, 'studio.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'vendor-phaser';
          if (id.includes('node_modules/react')) return 'vendor-react';
          if (id.includes('/src/studio/music/')) return 'studio-music';
          if (id.includes('/src/studio/assets/')) return 'studio-assets';
          if (id.includes('/src/studio/simulation/')) return 'studio-simulation';
          return undefined;
        },
      },
    },
  },
});
