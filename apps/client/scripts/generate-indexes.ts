import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDocRegistry } from './lib/docRegistry';
import { generateExampleStoriesIndex } from './lib/exampleStoriesIndex';
import { generateMigrationsIndex } from './lib/migrationsIndex';
import { generateShippedPacksIndex } from './lib/shippedPacksIndex';

/**
 * The five indexes the app needs written before it compiles.
 *
 * Migrations, example stories, shipped packs, help pages and literary devices live in content folders, and Metro only
 * bundles what is statically imported - there is no folder to scan on the device. Each of these
 * generators scans the folder here, on the build machine, and writes a file with one `import` per item
 * found.
 *
 * It runs on its own: it is the client's `prestart`/`prebuild`.
 */
const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

generateMigrationsIndex(clientRoot);
generateExampleStoriesIndex(clientRoot);
generateShippedPacksIndex(clientRoot);
generateDocRegistry({
  contentDir: join(clientRoot, 'src/help/content'),
  outputFile: join(clientRoot, 'src/help/generated/registry.ts'),
  typeName: 'GeneratedHelpPageId',
  registryName: 'helpRegistry',
  pageTypeImport: "import type { HelpPage } from '../types';",
});
generateDocRegistry({
  contentDir: join(clientRoot, 'src/storyDevices/content'),
  outputFile: join(clientRoot, 'src/storyDevices/generated/registry.ts'),
  typeName: 'GeneratedStoryDeviceId',
  registryName: 'storyDeviceRegistry',
  pageTypeImport: "import type { HelpPage } from '../../help/types';",
});
