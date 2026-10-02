import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { logger } from '../utils/logger';
import {
  hostedClientCacheControl,
  hostedClientMimeType,
  rewriteHostedClientHtml,
} from './hostedClient';
import {
  isCompressibleContentType,
  StaticDelivery,
  type StaticDeliveryInput,
} from './staticDelivery';

/** One delivery cache for the whole hosted client: what is compressed once is compressed for everyone. */
export const hostedClientDelivery = new StaticDelivery();

/**
 * A file of the client export as `StaticDelivery` takes it. The entry page is read through the HTML
 * rewrite (the `keres-hosted` marker and the history guard), so what is compressed, tagged and cached
 * is what the browser actually receives.
 */
export function hostedClientDeliveryInput(
  clientDist: string,
  filePath: string,
  html: boolean,
): Omit<StaticDeliveryInput, 'request'> {
  const stats = statSync(filePath);
  const relativePath = `/${path.relative(clientDist, filePath).split(path.sep).join('/')}`;
  return {
    key: filePath,
    version: `${stats.mtimeMs}-${stats.size}`,
    contentType: html ? 'text/html; charset=utf-8' : hostedClientMimeType(filePath),
    cacheControl: hostedClientCacheControl(relativePath, html),
    load: html
      ? () => new TextEncoder().encode(rewriteHostedClientHtml(readFileSync(filePath, 'utf8')))
      : () => new Uint8Array(readFileSync(filePath)),
  };
}

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

/**
 * Compresses the export's big files right after the server starts, one at a time, so the first visitor
 * is not the one who waits for it (a couple of seconds a file, on the thread pool: the server keeps
 * answering). Best-effort: a file it cannot do is done on its first request instead.
 */
export async function warmHostedClientDelivery(clientDist: string): Promise<void> {
  const started = Date.now();
  let warmed = 0;
  try {
    for (const filePath of listFiles(clientDist)) {
      const html = path.extname(filePath).toLowerCase() === '.html';
      const input = hostedClientDeliveryInput(clientDist, path.normalize(filePath), html);
      // Only what is worth it: small files are quick to do on the spot.
      if (!isCompressibleContentType(input.contentType) || statSync(filePath).size < 64 * 1024) {
        continue;
      }
      await hostedClientDelivery.warm(input);
      warmed += 1;
    }
    if (warmed > 0) {
      logger.info(
        `Hosted client compressed ahead of time: ${warmed} file(s) in ${Date.now() - started} ms.`,
      );
    }
  } catch (error) {
    logger.warn('Could not compress the hosted client ahead of time; it will be done on demand.', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
