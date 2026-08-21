import { existsSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';

/** Prefixo público do cliente web co-hospedado. O export do Expo continua com paths em `/`. */
export const CLIENT_APP_PREFIX = '/app';

/**
 * Isolamento entre origens: o `expo-sqlite` web precisa de `SharedArrayBuffer`, e o Chromium
 * só cria esse objeto numa página `crossOriginIsolated`. Os mesmos dois cabeçalhos que o
 * Electron já põe no esquema `app://`. Não misturar com o CSP do painel — o bundle Expo
 * usa workers e `blob:` para mídia.
 */
export const CLIENT_APP_ISOLATION_HEADERS: Record<string, string> = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const MIME_BY_EXTENSION: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

/**
 * O export do Expo (`output: "single"`) aponta `src`/`href` para a raiz do origin
 * (`/_expo/...`). Em `/app` esses caminhos 404. Reescrever só o HTML — o bundle é único
 * e os WASM saem relativos ao JS. O Electron continua a servir o mesmo `dist` na raiz
 * do `app://`, sem esta reescrita.
 */
export function rewriteHostedClientHtml(html: string): string {
  return html.replace(/(href|src)="\/(?!app\/)/g, '$1="/app/');
}

export function hostedClientMimeType(filePath: string): string {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Resolve um pedido `/app/...` para um ficheiro dentro do export, sem sair da raiz.
 * Sem extensão (rota de SPA) cai no `index.html`.
 */
export function resolveHostedClientFile(
  clientDist: string,
  requestPath: string,
): { filePath: string; html: boolean } | null {
  const relative =
    requestPath === CLIENT_APP_PREFIX || requestPath === `${CLIENT_APP_PREFIX}/`
      ? 'index.html'
      : requestPath.slice(CLIENT_APP_PREFIX.length).replace(/^\/+/, '') || 'index.html';
  const decoded = decodeURIComponent(relative);
  const hasExtension = path.extname(decoded).length > 0;
  const candidate = hasExtension ? decoded : path.join(decoded, 'index.html');
  const filePath = path.normalize(path.join(clientDist, candidate));
  const root = path.normalize(clientDist);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return null;
  }
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return { filePath, html: path.extname(filePath).toLowerCase() === '.html' };
  }
  if (!hasExtension) {
    const indexPath = path.join(root, 'index.html');
    if (existsSync(indexPath) && statSync(indexPath).isFile()) {
      return { filePath: indexPath, html: true };
    }
  }
  return null;
}

export function readHostedClientFile(
  clientDist: string,
  requestPath: string,
): { body: Uint8Array | string; contentType: string } | null {
  const resolved = resolveHostedClientFile(clientDist, requestPath);
  if (!resolved) {
    return null;
  }
  if (resolved.html) {
    return {
      body: rewriteHostedClientHtml(readFileSync(resolved.filePath, 'utf8')),
      contentType: 'text/html; charset=utf-8',
    };
  }
  return {
    body: new Uint8Array(readFileSync(resolved.filePath)),
    contentType: hostedClientMimeType(resolved.filePath),
  };
}

/**
 * O bundle do Expo pede o worker WASM e as fontes em caminhos da raiz (`/_expo/...`,
 * `/assets/...`), não sob `/app`. Sem estes ficheiros no origin, o SQLite web e os
 * ícones 404 — e o router mostra o ecrã unmatched.
 */
export function isClientDistRootAssetPath(pathname: string): boolean {
  return pathname.startsWith('/_expo/') || pathname.startsWith('/assets/');
}

export function readClientDistRootAsset(
  clientDist: string,
  requestPath: string,
): { body: Uint8Array; contentType: string } | null {
  const relative = decodeURIComponent(requestPath.replace(/^\/+/, ''));
  const filePath = path.normalize(path.join(clientDist, relative));
  const root = path.normalize(clientDist);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return null;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return null;
  }
  return {
    body: new Uint8Array(readFileSync(filePath)),
    contentType: hostedClientMimeType(filePath),
  };
}
