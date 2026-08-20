const path = require('path');
const { generateDocRegistry } = require('./lib/generate-doc-registry');

generateDocRegistry({
  contentDir: path.join(__dirname, '../src/storyDevices/content'),
  outputFile: path.join(__dirname, '../src/storyDevices/generated/registry.ts'),
  typeName: 'GeneratedStoryDeviceId',
  registryName: 'storyDeviceRegistry',
  pageTypeImport: "import type { HelpPage } from '../../help/types';",
  scriptName: 'generate-story-devices-index.js',
});
