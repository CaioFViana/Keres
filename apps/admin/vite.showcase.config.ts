import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { keresFavicon, keresLogo } from './vite.keresIcon';

const adminDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A entrada se chama `showcase.html` para conviver com o `index.html` do painel na mesma
 * pasta; o servidor, porém, procura `index.html` no diretório de saída, como em qualquer SPA.
 * Renomear na emissão é mais simples do que criar um diretório-raiz só para o arquivo.
 */
function emitAsIndexHtml(): Plugin {
  return {
    name: 'keres-showcase-index',
    // Depois do build inteiro: o HTML é emitido pelo próprio plugin de HTML do Vite, então
    // renomear em `generateBundle` competiria com ele pela ordem dos hooks. Renomear o arquivo
    // já escrito é determinístico.
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
 * A segunda saída de build deste mesmo projeto: o site público (Showcase).
 *
 * `base: '/_showcase/'` com as *páginas* na raiz é deliberado. Montar os arquivos estáticos
 * direto em `/` faria o plugin de estáticos do Elysia sombrear as rotas da API; com o prefixo
 * próprio, o servidor entrega os assets ali e devolve o index.html para qualquer outro caminho
 * que não seja da API (ver o catch-all em apps/api/src/index.ts).
 *
 * O painel admin continua saindo em `dist/` com `base: '/admin/'`, intocado.
 *
 * Favicon e marca saem do mesmo ícone do app de desktop que o painel já usa - ver
 * vite.keresIcon.ts.
 */
export default defineConfig({
  plugins: [react(), emitAsIndexHtml(), keresFavicon(), keresLogo()],
  base: '/_showcase/',
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
      // O site só fala com `/public/*` - não existe rota autenticada aqui.
      '/public': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
