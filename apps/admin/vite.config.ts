import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import { defineConfig, type Plugin } from 'vite';

const adminDirectory = path.dirname(fileURLToPath(import.meta.url));
/** Same source the desktop app uses (electron-builder.yml / main.ts) - not copied into admin. */
const desktopIconPath = path.resolve(
  adminDirectory,
  '..',
  'client',
  'assets',
  'images',
  'desktop_icon.png',
);

/**
 * Builds a real multi-size `favicon.ico` from `desktop_icon.png` at build/dev time
 * (16/24/32/48/64), the same idea as electron-builder converting that PNG to .ico.
 * The PNG stays in apps/client; only the generated .ico lands in admin dist.
 */
function keresFavicon(): Plugin {
  let icoPromise: Promise<Buffer> | null = null;
  const ico = () => {
    icoPromise ??= pngToIco(desktopIconPath);
    return icoPromise;
  };
  return {
    name: 'keres-favicon',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/favicon.ico' && url !== '/admin/favicon.ico') {
          next();
          return;
        }
        ico()
          .then((buf) => {
            res.setHeader('Content-Type', 'image/x-icon');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(buf);
          })
          .catch(next);
      });
    },
    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'favicon.ico',
        source: await ico(),
      });
    },
  };
}

// Em dev, o app roda no seu próprio servidor Vite (HMR rápido) e o proxy abaixo encaminha
// as chamadas de API para o Bun/Elysia rodando à parte. Em produção não há proxy: o próprio
// Elysia serve o build estático deste app e as rotas /admin/api/* no mesmo processo/porta
// (ver apps/api/src/index.ts) - o cliente sempre usa caminhos relativos, então funciona
// igual nos dois casos sem configuração extra.
export default defineConfig({
  plugins: [react(), keresFavicon()],
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
