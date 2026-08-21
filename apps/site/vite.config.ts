import react from '@vitejs/plugin-react';
import { copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { keresFavicon, keresLogo } from './vite.keresIcon';

const siteDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * GitHub Pages trata o repositório como um site de projeto (`/<repo>/`). Sem `base`
 * certo, os assets 404. Em desenvolvimento a raiz é `/`, para `vite dev` abrir direto.
 *
 * `VITE_BASE` existe para o workflow de Pages injetar o nome real do repositório —
 * maiúsculas inclusas — em vez de assumir `/keres/`.
 */
function publicBase(command: 'build' | 'serve'): string {
  if (process.env.VITE_BASE) {
    const value = process.env.VITE_BASE;
    return value.endsWith('/') ? value : `${value}/`;
  }
  return command === 'serve' ? '/' : '/Keres/';
}

/**
 * GitHub Pages corre Jekyll por omissão (o que ignora pastas que começam com `_`)
 * e não tem fallback de SPA: um refresh em qualquer caminho que não seja a raiz
 * vira 404. `.nojekyll` desliga o Jekyll; copiar `index.html` para `404.html` faz
 * o GitHub devolver a landing, que o navegador trata como a home.
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
