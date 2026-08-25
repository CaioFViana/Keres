import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { repoRoot } from './lib/packages';

/**
 * Conta linhas de código (sem comentários nem linhas vazias) por aplicação.
 *
 *   bun run code:lines
 *
 * Ferramenta de leitura, não de check: nada na CI depende dela.
 */

const applications: [name: string, path: string, excluded?: string[]][] = [
  ['API', 'apps/api'],
  ['ADM', 'apps/admin'],
  ['Client', 'apps/client', ['apps/client/src/help', 'apps/client/src/storyDevices']],
  ['Client-Help', 'apps/client/src/help'],
  ['Client-StoryDevices', 'apps/client/src/storyDevices'],
  ['Desktop', 'apps/desktop'],
  ['Site', 'apps/site'],
];

// Diretórios de dependências, saída de build, metadados ou código gerado.
const ignoredDirectories = new Set([
  '.git',
  '.expo',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'drizzle',
  'generated',
  'node_modules',
  'out',
]);
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

function countLines(filePath: string): number {
  const content = readFileSync(filePath, 'utf8');
  let inBlockComment = false;
  let inString: string | null = null;
  let lines = 0;

  for (const line of content.split(/\r?\n/)) {
    let hasCode = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const next = line[index + 1];

      if (inBlockComment) {
        if (character === '*' && next === '/') {
          inBlockComment = false;
          index += 1;
        }
        continue;
      }

      if (inString) {
        hasCode = true;
        if (character === '\\') index += 1;
        else if (character === inString) inString = null;
        continue;
      }

      if (character === '/' && next === '/') break;
      if (character === '/' && next === '*') {
        inBlockComment = true;
        index += 1;
        continue;
      }
      if (character === "'" || character === '"' || character === '`') {
        inString = character;
        hasCode = true;
        continue;
      }
      if (!/\s/.test(character)) hasCode = true;
    }

    if (hasCode) lines += 1;
  }

  return lines;
}

function countApplication(rootPath: string, excludedPaths: string[] = []) {
  const code = { files: 0, lines: 0 };
  const tests = { files: 0, lines: 0 };
  const excludedDirectories = new Set(excludedPaths.map((excludedPath) => resolve(excludedPath)));

  const visit = (directory: string, isTestDirectory = false): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const childDirectory = join(directory, entry.name);
        if (
          !ignoredDirectories.has(entry.name) &&
          !excludedDirectories.has(resolve(childDirectory))
        )
          visit(childDirectory, isTestDirectory || entry.name === 'test');
        continue;
      }
      if (!entry.isFile() || !codeExtensions.has(extname(entry.name))) continue;
      const category = isTestDirectory ? tests : code;
      category.files += 1;
      category.lines += countLines(join(directory, entry.name));
    }
  };

  visit(rootPath);
  return { code, tests };
}

const applicationsResults = applications.map(([name, relativePath, excludedPaths]) => ({
  name,
  ...countApplication(
    join(repoRoot, relativePath),
    (excludedPaths ?? []).map((excludedPath) => join(repoRoot, excludedPath)),
  ),
}));
const results = applicationsResults.map(({ name, code }) => ({ name, ...code }));
const tests = applicationsResults.reduce(
  (sum, result) => ({
    files: sum.files + result.tests.files,
    lines: sum.lines + result.tests.lines,
  }),
  { files: 0, lines: 0 },
);
const total = [...results, tests].reduce(
  (sum, result) => ({ files: sum.files + result.files, lines: sum.lines + result.lines }),
  { files: 0, lines: 0 },
);

console.table(
  [...results, { name: 'Testes', ...tests }, { name: 'Total', ...total }].map((result) => ({
    Aplicação: result.name,
    Arquivos: result.files,
    'Linhas de código': result.lines,
  })),
);
