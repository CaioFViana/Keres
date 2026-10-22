import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

/**
 * Serves the client's `dist-pages` the way GitHub Pages does: plain files under a path prefix, a 404 for
 * anything else, and no `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers. The missing
 * headers are the point: the web client needs `SharedArrayBuffer` for its SQLite, and on Pages it gets it from
 * a service worker (`public/coi-sw.js`) that isolates the page after one reload. A server that sent the
 * headers itself would hide a failure of exactly that mechanism.
 *
 *   E2E_DIST=../client/dist-pages E2E_BASE=/Keres/client E2E_PORT=4173 bun static-server.ts
 */
const DIST = resolve(process.env.E2E_DIST ?? '../client/dist-pages');
const BASE = process.env.E2E_BASE ?? '/Keres/client';
const PORT = Number(process.env.E2E_PORT ?? 4173);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

// Not fatal: a run of the other project (`--project online`) has no use for this build, and the pages tests fail with
// a 404 that says the same.
if (!existsSync(join(DIST, 'index.html'))) {
  console.warn(`No build at ${DIST}: run "bun run --cwd apps/client build:pages" first.`);
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) {
    response.writeHead(404).end('Not found');
    return;
  }
  const relative = normalize(pathname.slice(BASE.length)).replace(/^[/\\]+/, '');
  let file = join(DIST, relative);
  if (!file.startsWith(DIST)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`dist-pages at http://127.0.0.1:${PORT}${BASE}/`);
});
