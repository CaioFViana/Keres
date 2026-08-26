import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { keresFavicon } from './vite.keresIcon';

// In development the app runs on its own Vite server (fast HMR) and the proxy below forwards API
// calls to the Bun/Elysia process running separately. In production there is no proxy: Elysia
// itself serves this app's static build and the /api/* routes from the same process and port (see
// apps/api/src/index.ts) - the client always uses relative paths, so it works the same either way
// with no extra configuration.
export default defineConfig({
  // The favicon is generated from apps/client/assets/images/desktop_icon.png (the same icon as the
  // desktop app); the implementation lives in vite.keresIcon.ts, shared with the public site's build.
  plugins: [react(), keresFavicon(['/favicon.ico', '/admin/favicon.ico'])],
  base: '/admin/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
