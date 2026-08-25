import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDocRegistry } from './lib/docRegistry';
import { generateExampleStoriesIndex } from './lib/exampleStoriesIndex';
import { generateMigrationsIndex } from './lib/migrationsIndex';

/**
 * Os quatro índices que o app precisa ter escritos antes de compilar.
 *
 * Migrações, histórias de exemplo, páginas de ajuda e recursos literários moram em pastas de
 * conteúdo, e o Metro só empacota o que está importado estaticamente - não existe pasta para
 * varrer no dispositivo. Cada um destes geradores varre a pasta aqui, na máquina de build, e
 * escreve um arquivo com um `import` por item encontrado.
 *
 * Roda sozinho: é o `prestart`/`prebuild` do cliente.
 */
const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

generateMigrationsIndex(clientRoot);
generateExampleStoriesIndex(clientRoot);
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
