import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { keresAvatarIcons, keresFavicon, keresLogo } from './vite.keresIcon';

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
 * Serve `showcase.html` em desenvolvimento.
 *
 * `rollupOptions.input` só vale no build: sem isto, `vite dev` entrega o `index.html` da pasta,
 * que é o do painel admin - o servidor de desenvolvimento do site subia mostrando o painel.
 */
function serveShowcaseHtmlInDev(): Plugin {
  return {
    name: 'keres-showcase-dev-html',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0];
        // Só navegação: qualquer pedido de módulo ou asset segue o caminho normal.
        if (url && !url.includes('.') && req.headers.accept?.includes('text/html')) {
          req.url = '/showcase.html';
        }
        next();
      });
    },
  };
}

/**
 * A segunda saída de build deste mesmo projeto: o site público (Showcase).
 *
 * `base: '/_showcase/'` com as *páginas* em `/showcase` é deliberado. Montar os arquivos
 * estáticos direto em `/` sombrearia o cliente web (e as rotas da API); o prefixo próprio
 * entrega os assets em `/_showcase/` e o HTML em `/showcase` (ver apps/api/src/index.ts).
 *
 * O painel admin continua saindo em `dist/` com `base: '/admin/'`, intocado.
 *
 * Favicon e marca saem do mesmo ícone do app de desktop que o painel já usa - ver
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
  // O prefixo só existe por causa de como a API monta os estáticos em produção. Em
  // desenvolvimento o site tem uma porta só para ele, e usar o prefixo aqui faria as páginas
  // responderem num caminho que não é o de verdade.
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
      // O site só fala com `/public/*` - não existe rota autenticada aqui.
      '/public': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
