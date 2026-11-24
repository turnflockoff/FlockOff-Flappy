import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

function resolveHtml(path) {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        // root index.html stays the Capacitor/PWA entry — it must load the game directly.
        main: resolveHtml('./index.html'),
        arcade: resolveHtml('./arcade.html'),
        flockoffFlappy: resolveHtml('./games/flockoff-flappy/index.html'),
      },
    },
  },
  server: {
    host: true,
  },
});
