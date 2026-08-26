import { join } from 'node:path';
import { generateLanguageContentIndex } from './languageContentIndex';

/**
 * The index of the example stories: one folder per story in `content/<slug>/`, and one
 * `<lang>.json` inside it per language.
 *
 * The scan itself is shared with the shipped packs, which have the same folder shape - see
 * `languageContentIndex.ts`.
 */
export function generateExampleStoriesIndex(clientRoot: string): void {
  console.log('Generating example stories registry...');
  generateLanguageContentIndex({
    contentDir: join(clientRoot, 'src/exampleStories/content'),
    outputFile: join(clientRoot, 'src/exampleStories/generated/registry.ts'),
    registryName: 'exampleStoryRegistry',
    typeName: 'ExampleStoryEntry',
    typeImport: "import type { ExampleStoryEntry } from '../types';",
    payloadProperty: 'story',
    describe: (count) =>
      `Example stories registry generated successfully (${count} example stor${count === 1 ? 'y' : 'ies'})`,
  });
}
