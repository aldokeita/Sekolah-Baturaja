import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Konfigurasi test berdiri sendiri, tidak memakai vite.config.js, supaya test
// tidak ikut memuat plugin build (visualizer, dsb) yang tidak relevan.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(rootDir, './src') },
  },
  test: {
    // jsdom dipakai karena beberapa modul menyinggung localStorage saat dimuat.
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    restoreMocks: true,
  },
});
