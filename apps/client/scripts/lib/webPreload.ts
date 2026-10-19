import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where a web export keeps CanvasKit, relative to its output folder. The file name carries a hash of
 * its bytes (`canvaskit.<hash>.wasm`), so it is looked up, not written down.
 */
const CANVASKIT_DIRECTORY = join('assets', '__node_modules', 'canvaskit-wasm', 'bin', 'full');

/** The export's CanvasKit file, as a path from the root of the exported site (`/assets/...`), or null. */
export function findCanvasKitWasm(outputDirectory: string): string | null {
  const directory = join(outputDirectory, CANVASKIT_DIRECTORY);
  if (!existsSync(directory)) return null;
  const file = readdirSync(directory).find((name) => /^canvaskit\.[0-9a-f]+\.wasm$/.test(name));
  return file ? `/${CANVASKIT_DIRECTORY.split('\\').join('/')}/${file}` : null;
}

/**
 * The prefix the export was built for (`''` at the root, `/client` for the API, `/Keres/client` on
 * Pages), read from where the export itself put it: the entry script's URL. Every URL in the export
 * carries it, and a preload that does not match the URL the app asks for is a second download, not a
 * saving - so the prefix comes from the export and never from a setting that could drift from it.
 */
export function exportBasePath(html: string): string | null {
  const match = html.match(/<script[^>]+src="([^"]*)\/_expo\/static\/js\/web\/index-[^"]+\.js"/);
  return match ? match[1] : null;
}

/**
 * Starts the CanvasKit download with the page, not after the bundle.
 *
 * The app cannot start before CanvasKit does (see `index.js`), and it asks for the file only once the
 * bundle has downloaded and run - eight megabytes that begin after ten, one behind the other. A preload
 * in the HTML head makes both start at once, so what remains is the longer of the two instead of their
 * sum. The element mirrors how CanvasKit fetches it: a plain `fetch`, which on the same origin is a CORS
 * request without credentials, hence `as="fetch"` and `crossorigin`.
 */
export function injectCanvasKitPreload(html: string, wasmUrl: string): string {
  const link = `<link rel="preload" href="${wasmUrl}" as="fetch" type="application/wasm" crossorigin="anonymous">`;
  if (html.includes(wasmUrl)) return html;
  return html.replace('</head>', `${link}\n</head>`);
}

/** Writes the preload into the exported `index.html`. Returns the URL it points at, or null if it could not. */
export function applyCanvasKitPreload(
  html: string,
  outputDirectory: string,
): { html: string; wasmUrl: string | null } {
  const wasm = findCanvasKitWasm(outputDirectory);
  const base = exportBasePath(html);
  if (!wasm || base === null) return { html, wasmUrl: null };
  const wasmUrl = `${base}${wasm}`;
  return { html: injectCanvasKitPreload(html, wasmUrl), wasmUrl };
}
