import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { repoRoot } from './lib/packages';

/**
 * Counts lines of code (comments and blank lines excluded) per category and reports the
 * largest files overall, keeping application code, tooling and content separate in the totals.
 *
 *   bun run code:lines
 *
 * A reading tool, not a check: nothing in CI depends on it.
 */

const applications: [name: string, path: string][] = [
  ['Shared', 'packages/shared'],
  ['API', 'apps/api'],
  ['ADM', 'apps/admin'],
  ['Client', 'apps/client'],
  ['Desktop', 'apps/desktop'],
  ['Site', 'apps/site'],
];

const categories: [name: string, path: string][] = [
  ...applications,
  ['Client-Help', 'apps/client/src/help'],
  ['Client-StoryDevices', 'apps/client/src/storyDevices'],
  ['Client-Narratives', 'apps/client/scripts/lib/narratives'],
  ...applications.map(([name, path]): [string, string] => [`${name}-Scripts`, `${path}/scripts`]),
  ['Repo-Scripts', 'scripts'],
];
// The most specific directory owns the file; nested categories never count it twice.
const categoriesBySpecificity = [...categories].sort(
  (left, right) => right[1].length - left[1].length,
);

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
  category: string;
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

/** A single inventory supplies both the category totals and the overall size reports. */
function sourceFileLineCounts(): FileLineCount[] {
  const files: FileLineCount[] = [];

  const visit = (directory: string, isTestDirectory = false): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const childPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name))
          visit(childPath, isTestDirectory || ['test', 'tests', '__tests__'].includes(entry.name));
        continue;
      }
      if (!entry.isFile() || !codeExtensions.has(extname(entry.name))) continue;
      const path = relative(repoRoot, childPath).replaceAll('\\', '/');
      const category =
        isTestDirectory || /\.(test|spec)\.[jt]sx?$/.test(entry.name)
          ? 'Tests'
          : (categoriesBySpecificity.find(([, prefix]) => path.startsWith(`${prefix}/`))?.[0] ??
            'Other');
      files.push({ path, category, lines: countLines(childPath) });
    }
  };

  for (const root of sourceRoots) visit(join(repoRoot, root));
  return files;
}

const sourceFiles = sourceFileLineCounts();
const results = [...categories.map(([name]) => name), 'Other', 'Tests']
  .map((name) => {
    const files = sourceFiles.filter((file) => file.category === name);
    return { name, files: files.length, lines: files.reduce((sum, file) => sum + file.lines, 0) };
  })
  .filter((result) => result.files > 0);
const total = results.reduce(
  (sum, result) => ({ files: sum.files + result.files, lines: sum.lines + result.lines }),
  { files: 0, lines: 0 },
);

console.table(
  [...results, { name: 'Total', ...total }].map((result) => ({
    Category: result.name,
    Files: result.files,
    'Lines of code': result.lines,
  })),
);

const bySizeDescending = (left: FileLineCount, right: FileLineCount) =>
  right.lines - left.lines || left.path.localeCompare(right.path);
const formatFile = (file: FileLineCount) => ({
  File: file.path,
  'Lines of code': file.lines,
});

const files = sourceFiles.filter((file) => file.category !== 'Tests').sort(bySizeDescending);
const oversizedFiles = files.filter((file) => file.lines > fileLineLimit);
const nearLimitFiles = files
  .filter((file) => file.lines <= fileLineLimit)
  .slice(0, nearLimitFileCount);

console.log(`\nFiles above ${fileLineLimit} lines of code (${oversizedFiles.length})`);
console.table(oversizedFiles.map(formatFile));
console.log(`\nTop ${nearLimitFileCount} files at or below ${fileLineLimit} lines of code`);
console.table(nearLimitFiles.map(formatFile));
