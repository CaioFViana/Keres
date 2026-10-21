import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { adminAliases } from './vite.alias';
import { keresAvatarIcons, keresFavicon, keresLogo } from './vite.keresIcon';

const webDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * The entry point is called `showcase.html` so it can live alongside the panel's `index.html` in
 * the same folder; the server, however, looks for `index.html` in the output directory, as in any
 * SPA. Renaming on emit is simpler than creating a root directory just for the file.
 */
function emitAsIndexHtml(): Plugin {
  return {
    name: 'keres-showcase-index',
    async closeBundle() {
      const outDir = path.resolve(webDirectory, 'dist-showcase');
      const source = path.join(outDir, 'showcase.html');
      if (existsSync(source)) {
        await rename(source, path.join(outDir, 'index.html'));
      }
    },
  };
}

/**
 * Serves `showcase.html` in development.
 *
 * `rollupOptions.input` only applies to the build: without this, `vite dev` serves the folder's
 * `index.html`, which is the admin panel's - the site's development server came up showing the panel.
 */
function serveShowcaseHtmlInDev(): Plugin {
  return {
    name: 'keres-showcase-dev-html',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0];
        if (url && !url.includes('.') && req.headers.accept?.includes('text/html')) {
          req.url = '/showcase.html';
        }
        next();
      });
    },
  };
}

/**
 * This project's second build: the public site (Showcase), picked with `--mode showcase`
 * (`vite.config.ts`).
 *
 * `base: '/_showcase/'` with the *pages* at `/showcase` is deliberate. Mounting the static files
 * directly at `/` would shadow the web client (and the API routes); its own prefix serves the
 * assets under `/_showcase/` and the HTML at `/showcase` (see apps/api/src/web/webRoutes.ts).
 *
 * The admin panel still builds into `dist/` with `base: '/admin/'`, untouched.
 *
 * Favicon and wordmark come from the same desktop app icon the panel already uses - see
 * vite.keresIcon.ts.
 */
export const showcaseConfig = defineConfig(({ command }) => ({
  resolve: { alias: adminAliases },
  plugins: [
    react(),
    serveShowcaseHtmlInDev(),
    emitAsIndexHtml(),
    keresFavicon(),
    keresLogo(),
    keresAvatarIcons(),
  ],
  base: command === 'build' ? '/_showcase/' : '/',
  build: {
    outDir: 'dist-showcase',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(webDirectory, 'showcase.html'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
