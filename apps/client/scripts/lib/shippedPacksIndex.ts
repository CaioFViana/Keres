import { join } from 'node:path';
import { generateLanguageContentIndex } from './languageContentIndex';
import { srcAlias } from './srcAlias';

/**
 * The index of the packs Keres ships with: one folder per pack in `content/<slug>/`, and one
 * `<lang>.json` inside it per language.
 *
 * The content files are themselves generated, from `lib/shippedPackDefinitions.ts` by
 * `scripts/build-shipped-packs.ts`. This step only makes them reachable from a Metro bundle.
 */
export function generateShippedPacksIndex(clientRoot: string): void {
  console.log('Generating shipped packs registry...');
  generateLanguageContentIndex({
    contentDir: join(clientRoot, 'src/content/shipped-packs/content'),
    outputFile: join(clientRoot, 'src/content/shipped-packs/generated/registry.ts'),
    registryName: 'shippedPackRegistry',
    typeName: 'ShippedPackEntry',
    typeImport: `import type { ShippedPackEntry } from '${srcAlias(join(clientRoot, 'src/content/shipped-packs/types'))}';`,
    payloadProperty: 'pack',
    describe: (count) =>
      `Shipped packs registry generated successfully (${count} pack${count === 1 ? '' : 's'})`,
  });
}
