const fs = require('fs');
const path = require('path');

const applications = [
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

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let inBlockComment = false;
  let inString = null;
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

function countApplication(rootPath, excludedPaths = []) {
  const code = { files: 0, lines: 0 };
  const tests = { files: 0, lines: 0 };
  const excludedDirectories = new Set(
    excludedPaths.map((excludedPath) => path.resolve(excludedPath)),
  );

  const visit = (directory, isTestDirectory = false) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const childDirectory = path.join(directory, entry.name);
        if (
          !ignoredDirectories.has(entry.name) &&
          !excludedDirectories.has(path.resolve(childDirectory))
        )
          visit(childDirectory, isTestDirectory || entry.name === 'test');
        continue;
      }
      if (!entry.isFile() || !codeExtensions.has(path.extname(entry.name))) continue;
      const category = isTestDirectory ? tests : code;
      category.files += 1;
      category.lines += countLines(path.join(directory, entry.name));
    }
  };

  visit(rootPath);
  return { code, tests };
}

const applicationsResults = applications.map(([name, relativePath, excludedPaths]) => ({
  name,
  ...countApplication(
    path.join(__dirname, '..', relativePath),
    (excludedPaths ?? []).map((excludedPath) => path.join(__dirname, '..', excludedPath)),
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
