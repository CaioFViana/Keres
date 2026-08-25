import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { keresAvatarIcons, keresFavicon, keresLogo } from './vite.keresIcon';

const adminDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * The entry point is called `showcase.html` so it can live alongside the panel's `index.html` in
 * the same folder; the server, however, looks for `index.html` in the output directory, as in any
 * SPA. Renaming on emit is simpler than creating a root directory just for the file.
 */
function emitAsIndexHtml(): Plugin {
  return {
    name: 'keres-showcase-index',
    // After the whole build: the HTML is emitted by Vite's own HTML plugin, so renaming in
    // `generateBundle` would race it for hook order. Renaming the already-written file is deterministic.
    async closeBundle() {
      const outDir = path.resolve(adminDirectory, 'dist-showcase');
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
        // Navigation only: any module or asset request follows the normal path.
        if (url && !url.includes('.') && req.headers.accept?.includes('text/html')) {
          req.url = '/showcase.html';
        }
        next();
      });
    },
  };
}

/**
 * This same project's second build output: the public site (Showcase).
 *
 * `base: '/_showcase/'` with the *pages* at `/showcase` is deliberate. Mounting the static files
 * directly at `/` would shadow the web client (and the API routes); its own prefix serves the
 * assets under `/_showcase/` and the HTML at `/showcase` (see apps/api/src/index.ts).
 *
 * The admin panel still builds into `dist/` with `base: '/admin/'`, untouched.
 *
 * Favicon and wordmark come from the same desktop app icon the panel already uses - see
 * vite.keresIcon.ts.
 */
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    serveShowcaseHtmlInDev(),
    emitAsIndexHtml(),
    keresFavicon(),
    keresLogo(),
    keresAvatarIcons(),
  ],
  // The prefix only exists because of how the API mounts the static files in production. In
  // development the site has a port to itself, and using the prefix here would make the pages answer
  // on a path that is not the real one.
  base: command === 'build' ? '/_showcase/' : '/',
  build: {
    outDir: 'dist-showcase',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(adminDirectory, 'showcase.html'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      // The site only talks to `/public/*` - there is no authenticated route here.
      '/public': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
