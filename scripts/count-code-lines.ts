import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { repoRoot } from './lib/packages';

/**
 * Counts lines of code (comments and blank lines excluded) per application and reports the
 * largest source files so the per-file size ceiling can steadily shrink.
 *
 *   bun run code:lines
 *
 * A reading tool, not a check: nothing in CI depends on it.
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

// Dependency, build output, metadata or generated-code directories.
const ignoredDirectories = new Set([
  '.git',
  '.expo',
  '.turbo',
  'build',
  'coverage',
  'coverage-sync',
  'dist',
  'dist-server',
  'drizzle',
  'generated',
  'node_modules',
  'out',
  'lcov-report',
]);
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const fileLineLimit = 600;
const nearLimitFileCount = 20;
const sourceRoots = ['apps', 'packages', 'scripts'];

interface FileLineCount {
  path: string;
  lines: number;
}

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

/** Collects every production source file once, independently of the application summary above. */
function sourceFileLineCounts(): FileLineCount[] {
  const files: FileLineCount[] = [];

  const visit = (directory: string, isTestDirectory = false): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const childPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name))
          visit(childPath, isTestDirectory || entry.name === 'test');
        continue;
      }
      if (
        isTestDirectory ||
        !entry.isFile() ||
        !codeExtensions.has(extname(entry.name)) ||
        /\.(test|spec)\.[jt]sx?$/.test(entry.name)
      )
        continue;
      files.push({ path: childPath, lines: countLines(childPath) });
    }
  };

  for (const root of sourceRoots) visit(join(repoRoot, root));
  return files;
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
  [...results, { name: 'Tests', ...tests }, { name: 'Total', ...total }].map((result) => ({
    Application: result.name,
    Files: result.files,
    'Lines of code': result.lines,
  })),
);

const sourceFiles = sourceFileLineCounts();
const bySizeDescending = (left: FileLineCount, right: FileLineCount) =>
  right.lines - left.lines || left.path.localeCompare(right.path);
const oversizedFiles = sourceFiles
  .filter((file) => file.lines > fileLineLimit)
  .sort(bySizeDescending);
const nearLimitFiles = sourceFiles
  .filter((file) => file.lines <= fileLineLimit)
  .sort(bySizeDescending)
  .slice(0, nearLimitFileCount);
const formatFile = (file: FileLineCount) => ({
  File: file.path.slice(repoRoot.length + 1).replaceAll('\\', '/'),
  'Lines of code': file.lines,
});

console.log(`\nFiles above ${fileLineLimit} lines of code (${oversizedFiles.length})`);
console.table(oversizedFiles.map(formatFile));
console.log(`\nTop ${nearLimitFileCount} files at or below ${fileLineLimit} lines of code`);
console.table(nearLimitFiles.map(formatFile));
