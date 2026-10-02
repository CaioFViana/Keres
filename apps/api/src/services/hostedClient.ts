import { existsSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';

/** The showcase's public prefix, after the root became the web client. */
export const SHOWCASE_PATH_PREFIX = '/showcase';

/**
 * Cross-origin isolation: web `expo-sqlite` needs `SharedArrayBuffer`, and Chromium only creates that
 * object on a `crossOriginIsolated` page. The same two headers Electron already sets on the `app://`
 * scheme. Do not mix this with the panel's CSP - the Expo bundle uses workers and `blob:` for media.
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
 * Marks the HTML the API serves so the client knows it is co-hosted (cookie session, same-origin).
 * Electron and `expo start --web` do not go through this rewrite.
 */
export const HOSTED_CLIENT_META = '<meta name="keres-hosted" content="1" />';

/**
 * Where the web client lives on the origin: `/client`, so the root stays free. The client export that
 * is served here is built for exactly this prefix (`KERES_WEB_BASE_URL=/client`, see
 * `build:hosted` in apps/client) - the base path is baked into every asset URL it contains, which
 * is why it is a different export from the desktop shell's, built for the root.
 */
export const HOSTED_CLIENT_PATH_PREFIX = '/client';

/** Whether a request path belongs to the hosted client: its entry page, its assets, its screens. */
export function isHostedClientPath(pathname: string): boolean {
  return (
    pathname === HOSTED_CLIENT_PATH_PREFIX || pathname.startsWith(`${HOSTED_CLIENT_PATH_PREFIX}/`)
  );
}

/** The request path as the export sees it: `/client/_expo/a.js` is `/_expo/a.js`, `/client` is `/`. */
export function hostedClientRelativePath(pathname: string): string {
  const rest = pathname.slice(HOSTED_CLIENT_PATH_PREFIX.length);
  return rest === '' ? '/' : rest;
}

/**
 * The URL always stays at `/client/`. React Navigation can write a screen's name into the bar
 * (`/client/StorySelection`), and an F5 there would ask the server for a path the client has no file for;
 * keeping the address where it started makes a reload come back to the client. The screens' state is
 * React Navigation's, not the path's. Electron never sees this script.
 */
export const HOSTED_CLIENT_HISTORY_GUARD = `<script>(function(){function here(){return "${HOSTED_CLIENT_PATH_PREFIX}/"+location.search+location.hash}var push=history.pushState.bind(history),rep=history.replaceState.bind(history);history.pushState=function(){return push(null,"",here())};history.replaceState=function(){return rep(null,"",here())};try{rep(null,"",here())}catch(e){}})();</script>`;

export function rewriteHostedClientHtml(html: string): string {
  let next = html;
  // Order matters: the history guard goes in first so the meta marker wins position zero,
  // right after `<head>` or at the very start when the page has no head element.
  if (
    !next.includes('HOSTED_CLIENT_HISTORY_GUARD') &&
    !next.includes('history.pushState=function()')
  ) {
    next = /<head>/i.test(next)
      ? next.replace(/<head>/i, `<head>${HOSTED_CLIENT_HISTORY_GUARD}`)
      : `${HOSTED_CLIENT_HISTORY_GUARD}${next}`;
  }
  if (!/<meta\s+name="keres-hosted"/i.test(next)) {
    next = /<head>/i.test(next)
      ? next.replace(/<head>/i, `<head>${HOSTED_CLIENT_META}`)
      : `${HOSTED_CLIENT_META}${next}`;
  }
  return next;
}

/**
 * How long a browser may keep a file of the export without asking. The export names everything under
 * `/_expo/static` and `/assets` after a hash of its bytes, so a URL there never changes meaning: a
 * year, and `immutable` so a reload does not even ask. Everything else - the entry page above all, which
 * is what points at those names after an update - is kept but checked every time (an `ETag` makes
 * that check a 304 with no body).
 */
export function hostedClientCacheControl(relativePath: string, html: boolean): string {
  if (!html && (relativePath.startsWith('/_expo/static/') || relativePath.startsWith('/assets/'))) {
    return 'public, max-age=31536000, immutable';
  }
  return 'no-cache';
}

export function hostedClientMimeType(filePath: string): string {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Resolves a request path (already relative to the client's prefix, see `hostedClientRelativePath`) to a
 * file from the Expo export. With no extension (an SPA /
 * React Navigation route) it falls back to `index.html`.
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

export function isShowcasePath(pathname: string): boolean {
  return pathname === SHOWCASE_PATH_PREFIX || pathname.startsWith(`${SHOWCASE_PATH_PREFIX}/`);
}
