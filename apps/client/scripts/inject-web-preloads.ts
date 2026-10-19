import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { applyCanvasKitPreload } from './lib/webPreload';

/**
 * Run after `expo export -p web`: puts the preload of CanvasKit in the export's `index.html`.
 *
 *   bun scripts/inject-web-preloads.ts <output folder>
 *
 * Every web export goes through it (`build`, `build:hosted`, `build:pages`, and the API's Docker stage),
 * since each one boots on CanvasKit. See `webPreload.ts` for why.
 */
const outputDirectory = resolve(process.argv[2] ?? 'dist');
const indexPath = join(outputDirectory, 'index.html');

const { html, wasmUrl } = applyCanvasKitPreload(readFileSync(indexPath, 'utf8'), outputDirectory);
if (!wasmUrl) {
  // Not fatal - the app boots the same, only later - but loud: a silent loss of this is how it would be
  // missed for months.
  console.warn(`[preload] no CanvasKit file (or no entry script) found in ${outputDirectory}.`);
  process.exit(0);
}
writeFileSync(indexPath, html);
console.log(`[preload] ${wasmUrl} is now preloaded by ${indexPath}`);
