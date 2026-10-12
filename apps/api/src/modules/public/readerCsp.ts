import { readerScriptBundles } from '@keres/shared';
import { createHash } from 'node:crypto';

/**
 * The Content-Security-Policy of a published reader page.
 *
 * The page carries its own engine inside one inline `<script>` block, so the policy names the
 * exact bytes it may run: the SHA-256 of each of the three bundles `readerScriptBundles()`
 * serves (branching, linear, comic), hashed here at startup from the same builder the compiler
 * uses, so the two cannot drift apart. `unsafe-inline` stays alongside the hashes on purpose:
 * a browser that understands hashes ignores it and runs only the three known bundles, while an
 * older one without hash support still opens the reader - and so do pages published before the
 * hashes existed, under their immutable year-long cache.
 */

function hashOf(source: string): string {
  return `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`;
}

const bundles = readerScriptBundles();

/** The three script hashes the served policy carries, one per reader kind. */
export const READER_SCRIPT_HASHES = [bundles.branching, bundles.linear, bundles.comic].map(hashOf);

export const READER_CSP = [
  'sandbox allow-scripts',
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  `script-src 'unsafe-inline' ${READER_SCRIPT_HASHES.join(' ')}`,
  'img-src data:',
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
