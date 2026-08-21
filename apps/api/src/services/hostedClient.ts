import { existsSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';

/** Prefixo público da vitrine, depois de a raiz passar a ser o cliente web. */
export const SHOWCASE_PATH_PREFIX = '/showcase';

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
 * Marca o HTML servido pela API para o cliente saber que está co-hospedado (sessão cookie,
 * same-origin). O Electron e o `expo start --web` não passam por esta reescrita.
 */
export const HOSTED_CLIENT_META = '<meta name="keres-hosted" content="1" />';

/**
 * Expo Router só tem a rota de ficheiro `/`. O React Navigation escreve o nome da tela
 * na barra (`/StorySelection`, …); o Router trata isso como unmatched (404). A solução
 * mais simples: o URL hospedado fica sempre em `/`. F5 recarrega o cliente; o estado
 * das telas é o do React Navigation, não o path. O Electron não vê este script.
 */
export const HOSTED_CLIENT_HISTORY_GUARD = `<script>(function(){function here(){return "/"+location.search+location.hash}var push=history.pushState.bind(history),rep=history.replaceState.bind(history);history.pushState=function(){return push(null,"",here())};history.replaceState=function(){return rep(null,"",here())};try{rep(null,"",here())}catch(e){}})();</script>`;

export function rewriteHostedClientHtml(html: string): string {
  let next = html;
  if (!/<meta\s+name="keres-hosted"/i.test(next)) {
    next = /<head>/i.test(next)
      ? next.replace(/<head>/i, `<head>${HOSTED_CLIENT_META}`)
      : `${HOSTED_CLIENT_META}${next}`;
  }
  if (
    !next.includes('HOSTED_CLIENT_HISTORY_GUARD') &&
    !next.includes('history.pushState=function()')
  ) {
    next = /<head>/i.test(next)
      ? next.replace(/<head>/i, `<head>${HOSTED_CLIENT_HISTORY_GUARD}`)
      : `${HOSTED_CLIENT_HISTORY_GUARD}${next}`;
  }
  return next;
}

export function hostedClientMimeType(filePath: string): string {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Resolve um pedido na raiz do origin para um ficheiro do export Expo. Sem extensão
 * (rota de SPA / React Navigation) cai no `index.html`.
 */
export function resolveHostedClientFile(
  clientDist: string,
  requestPath: string,
): { filePath: string; html: boolean } | null {
  const relative =
    requestPath === '/' || requestPath === ''
      ? 'index.html'
      : requestPath.replace(/^\/+/, '') || 'index.html';
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

export function isClientDistRootAssetPath(pathname: string): boolean {
  return pathname.startsWith('/_expo/') || pathname.startsWith('/assets/');
}

export function isShowcasePath(pathname: string): boolean {
  return pathname === SHOWCASE_PATH_PREFIX || pathname.startsWith(`${SHOWCASE_PATH_PREFIX}/`);
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
