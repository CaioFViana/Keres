import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPack } from './lib/buildShippedPack';
import { SHIPPED_PACKS } from './lib/shippedPackDefinitions';

/**
 * Writes `src/shippedPacks/content/<slug>/<lang>.json` from the definitions.
 *
 * One row per language rather than one pack with translated labels: a pack carries a `language`
 * string and no selector, exactly as a story does, so two languages are two packs. That is the
 * design rather than an exception to it - see `docs/packs_feature_plan.md` §9.
 *
 * The output is a `PackContentSchema` payload plus the metadata a shared pack travels with, so
 * installing one goes through the very same path a downloaded pack takes.
 */

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentRoot = join(clientRoot, 'src/shippedPacks/content');

let written = 0;
for (const definition of SHIPPED_PACKS) {
  const directory = join(contentRoot, definition.slug);
  mkdirSync(directory, { recursive: true });
  for (const language of ['en', 'pt'] as const) {
    writeFileSync(
      join(directory, `${language}.json`),
      `${JSON.stringify(buildPack(definition, language), null, 2)}
`,
    );
    written += 1;
  }
}

console.log(`Shipped packs written: ${written} files across ${SHIPPED_PACKS.length} packs.`);
