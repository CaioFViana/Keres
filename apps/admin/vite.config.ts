import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { keresFavicon } from './vite.keresIcon';

// Em dev, o app roda no seu próprio servidor Vite (HMR rápido) e o proxy abaixo encaminha
// as chamadas de API para o Bun/Elysia rodando à parte. Em produção não há proxy: o próprio
// Elysia serve o build estático deste app e as rotas /admin/api/* no mesmo processo/porta
// (ver apps/api/src/index.ts) - o cliente sempre usa caminhos relativos, então funciona
// igual nos dois casos sem configuração extra.
export default defineConfig({
  // O favicon é gerado a partir de apps/client/assets/images/desktop_icon.png (o mesmo ícone
  // do app de desktop); a implementação mora em vite.keresIcon.ts, compartilhada com o build
  // do site público.
  plugins: [react(), keresFavicon(['/favicon.ico', '/admin/favicon.ico'])],
  base: '/admin/',
  server: {
    port: 5173,
    proxy: {
      '/admin/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/auth': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
