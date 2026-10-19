import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { keresFavicon, keresLogo } from './vite.keresIcon';

/**
 * This same project's second build output: the landing page a Keres API serves at its own root.
 *
 * `base: '/_landing/'` with the *page* at `/` is deliberate, mirroring how the API mounts the
 * showcase under `/_showcase/`: mounting the static files directly at `/` would shadow the API
 * routes (see apps/api/src/index.ts). No GitHub Pages extras here - this bundle is never
 * published there.
 *
 * `VITE_SITE_VARIANT` switches the tiers, contact and official-server sections on. It is a
 * `define`, not an environment variable on the command line, so the build needs no shell
 * features (`VAR=value vite build` does not work in PowerShell/cmd).
 */
export default defineConfig(({ command }) => ({
  plugins: [react(), keresFavicon(), keresLogo()],
  define: {
    'import.meta.env.VITE_SITE_VARIANT': JSON.stringify('landing'),
  },
  base: command === 'build' ? '/_landing/' : '/',
  build: {
    outDir: 'dist-landing',
    emptyOutDir: true,
  },
  server: {
    port: 5176,
    proxy: {
      // The tiers section and the contact form talk to the API they are served by.
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
