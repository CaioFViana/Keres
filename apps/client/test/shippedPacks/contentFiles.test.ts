/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPack } from '../../scripts/lib/buildShippedPack';
import { SHIPPED_PACKS } from '../../scripts/lib/shippedPackDefinitions';

/**
 * The committed content files must be what the definitions produce.
 *
 * `src/shippedPacks/content/` is generated, and a definition edited without rerunning
 * `bun scripts/build-shipped-packs.ts` would ship packs that silently disagree with the source
 * everybody reads. Nothing else would catch it: the stale file still validates, still installs and
 * still looks right - it is simply the previous version.
 */

const contentRoot = join(__dirname, '../../src/shippedPacks/content');

describe('the generated pack content', () => {
  it.each(
    SHIPPED_PACKS.flatMap((definition) =>
      (['en', 'pt'] as const).map((language) => [definition.slug, language, definition] as const),
    ),
  )('matches the definitions for %s/%s', (slug, language, definition) => {
    const committed = readFileSync(join(contentRoot, slug, `${language}.json`), 'utf8');
    expect(committed).toBe(`${JSON.stringify(buildPack(definition, language), null, 2)}\n`);
  });
});
