import { readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { hostedClientMimeType } from './hostedClient';
import { StaticDelivery, type StaticDeliveryResult } from './staticDelivery';

/** One delivery cache for the static trees of the admin panel, the showcase and the landing page. */
export const distDelivery = new StaticDelivery();

/**
 * Vite names what it bundles `assets/<name>-<hash>.<ext>`, the hash being one of its bytes: such a URL
 * never changes meaning, so a browser keeps it for a year and does not even ask. Anything else in the
 * tree (the files copied from `public/`, like the landing's screenshots, or the favicon) keeps its
 * name when it changes, so it is kept for a day and checked after that - the `ETag` makes the check
 * a 304.
 */
export function distFileCacheControl(relativePath: string): string {
  return /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(relativePath)
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=86400';
}

/**
 * A file inside `dist`, or null: not there, a directory, or outside it. No fallback to an index page -
 * the callers decide what an unknown path means (the panel falls back to its SPA, the others say 404).
 */
export function resolveDistFile(dist: string, requestPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, '');
  if (relative === '') return null;
  const root = path.normalize(dist);
  const filePath = path.normalize(path.join(root, relative));
  if (!filePath.startsWith(root + path.sep)) return null;
  try {
    return statSync(filePath).isFile() ? filePath : null;
  } catch {
    return null;
  }
}

/** A file of a Vite build as the browser should get it, or null when there is no such file. */
export async function deliverDistFile(
  dist: string,
  requestPath: string,
  request: Request,
): Promise<StaticDeliveryResult | null> {
  const filePath = resolveDistFile(dist, requestPath);
  if (!filePath) return null;
  const stats = statSync(filePath);
  const relativePath = `/${path.relative(dist, filePath).split(path.sep).join('/')}`;
  return distDelivery.deliver({
    key: filePath,
    version: `${stats.mtimeMs}-${stats.size}`,
    contentType: hostedClientMimeType(filePath),
    cacheControl: distFileCacheControl(relativePath),
    load: () => new Uint8Array(readFileSync(filePath)),
    request: {
      acceptEncoding: request.headers.get('accept-encoding'),
      ifNoneMatch: request.headers.get('if-none-match'),
    },
  });
}
