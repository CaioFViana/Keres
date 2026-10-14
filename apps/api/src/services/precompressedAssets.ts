import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { ContentEncoding } from './staticDelivery';

/**
 * The compressed copies a build step leaves next to the static files (`apps/api/scripts/precompress-dist.ts`):
 * `app.js.br` and `app.js.gz` beside `app.js`, and `precompressed.json` at the root of the folder saying, for each
 * file, which encodings exist and the hash of the bytes they were made from. The hash is what keeps a copy honest: a
 * file replaced after the build no longer matches its entry, and is compressed on the spot like any other.
 */
export const PRECOMPRESSED_MANIFEST = 'precompressed.json';

export const PRECOMPRESSED_SUFFIX: Record<ContentEncoding, string> = { br: '.br', gzip: '.gz' };

export interface PrecompressedManifest {
  version: 1;
  /** Keyed by the path relative to the folder, with `/` separators. */
  files: Record<string, { hash: string; encodings: ContentEncoding[] }>;
}

const manifests = new Map<string, PrecompressedManifest | null>();

function manifestOf(root: string): PrecompressedManifest | null {
  const key = path.normalize(root);
  if (manifests.has(key)) return manifests.get(key) ?? null;
  let parsed: PrecompressedManifest | null = null;
  const manifestPath = path.join(key, PRECOMPRESSED_MANIFEST);
  if (existsSync(manifestPath)) {
    try {
      const candidate = JSON.parse(readFileSync(manifestPath, 'utf8')) as PrecompressedManifest;
      if (candidate.version === 1 && candidate.files && typeof candidate.files === 'object') {
        parsed = candidate;
      }
    } catch {
      // A manifest that cannot be read is a folder with nothing precompressed.
    }
  }
  manifests.set(key, parsed);
  return parsed;
}

/** Forgets what was read (tests, and a folder rebuilt while the server runs in development). */
export function resetPrecompressedManifests(): void {
  manifests.clear();
}

/**
 * The `precompressed` lookup of one file for `StaticDelivery`: a reader of its build-time copy for the encoding, when
 * the manifest lists it for the same bytes (`hash`) and the copy is on disk.
 */
export function precompressedFor(
  root: string,
  filePath: string,
): (hash: string, encoding: ContentEncoding) => (() => Uint8Array) | null {
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  return (hash, encoding) => {
    const entry = manifestOf(root)?.files[relative];
    if (!entry || entry.hash !== hash || !entry.encodings.includes(encoding)) return null;
    const copy = `${filePath}${PRECOMPRESSED_SUFFIX[encoding]}`;
    if (!existsSync(copy)) return null;
    return () => new Uint8Array(readFileSync(copy));
  };
}
