import react from '@vitejs/plugin-react';
import { copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { keresFavicon, keresLogo } from './vite.keresIcon';

const siteDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * GitHub Pages treats the repository as a project site (`/<repo>/`). Without the right
 * `base`, the assets 404. In development the root is `/`, so `vite dev` opens directly.
 *
 * `VITE_BASE` exists so the Pages workflow can inject the real repository name - uppercase
 * letters included - instead of assuming `/keres/`.
 */
function publicBase(command: 'build' | 'serve'): string {
  if (process.env.VITE_BASE) {
    const value = process.env.VITE_BASE;
    return value.endsWith('/') ? value : `${value}/`;
  }
  return command === 'serve' ? '/' : '/Keres/';
}

/**
 * GitHub Pages runs Jekyll by default (which ignores folders starting with `_`) and has no
 * SPA fallback: a refresh on any path other than the root turns into a 404. `.nojekyll`
 * turns Jekyll off; copying `index.html` to `404.html` makes GitHub return the landing page,
 * which the browser treats as the home page.
 */
function githubPagesExtras(): Plugin {
  return {
    name: 'keres-github-pages',
    async closeBundle() {
      const dist = path.resolve(siteDirectory, 'dist');
      await writeFile(path.join(dist, '.nojekyll'), '');
      await copyFile(path.join(dist, 'index.html'), path.join(dist, '404.html'));
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), keresFavicon(), keresLogo(), githubPagesExtras()],
  base: publicBase(command),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
  },
}));
