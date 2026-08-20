const path = require('path');
const { generateDocRegistry } = require('./lib/generate-doc-registry');

generateDocRegistry({
  contentDir: path.join(__dirname, '../src/help/content'),
  outputFile: path.join(__dirname, '../src/help/generated/registry.ts'),
  typeName: 'GeneratedHelpPageId',
  registryName: 'helpRegistry',
  pageTypeImport: "import type { HelpPage } from '../types';",
  scriptName: 'generate-help-index.js',
});
