import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COVERAGE_KINDS,
  type CoverageKind,
  type CoverageTotals,
  coveragePercentage,
  filterLcov,
  type LcovReport,
  mergeCoverage,
  mergeLcovReports,
  parseLcov,
} from './lib/coverage';
import { repoRoot } from './lib/packages';

/**
 * Enforces the scoped coverage floors on the paths that must never silently regress.
 *
 *   bun scripts/coverage-check.ts client
 *   bun scripts/coverage-check.ts api
 *
 * A workspace-wide floor averages every file together, so a well-tested periphery can hide an
 * untested sync core. These scopes re-measure only the sync engine, its entity handlers, and
 * (for the API) export/import against their own, higher floors from `coverage-thresholds.json`.
 * CI runs this after the ordinary workspace reports; `coverage-update.ts` raises both kinds of
 * floor together.
 *
 * The output is a table with one row per scope and one column per kind. A cell that is under its
 * floor starts with `✗` and says by how much, and a list below names each failure with how many
 * more lines/functions/branches would clear it and the files that miss the most.
 */
interface Scope {
  threshold: string;
  reports: [string, string][];
  prefixes: string[];
}

const scopesByProject: Record<string, Scope[]> = {
  client: [
    {
      threshold: 'clientSyncCore',
      reports: [['apps/client', 'coverage']],
      prefixes: [
        'src/services/sync/',
        'src/services/sync/SyncEngineService.ts',
        'src/services/sync/SyncConflictService.ts',
        'src/services/sync/ConflictSummaryService.ts',
      ],
    },
    {
      threshold: 'clientSyncHandlers',
      reports: [['apps/client', 'coverage']],
      prefixes: ['src/services/entity-sync-handlers/'],
    },
    {
      threshold: 'clientStoryServices',
      reports: [['apps/client', 'coverage']],
      prefixes: ['src/services/storymanagement/'],
    },
  ],
  api: [
    {
      threshold: 'apiSyncCore',
      reports: [
        ['apps/api', 'coverage'],
        ['apps/api', 'coverage-integration'],
      ],
      prefixes: ['src/services/sync/SyncService.ts'],
    },
    {
      threshold: 'apiSyncHandlers',
      reports: [
        ['apps/api', 'coverage'],
        ['apps/api', 'coverage-integration'],
      ],
      prefixes: ['src/services/entity-sync-handlers/'],
    },
    {
      threshold: 'apiExportImport',
      reports: [
        ['apps/api', 'coverage'],
        ['apps/api', 'coverage-integration'],
      ],
      prefixes: ['src/services/stories/StoryExportImportService.ts'],
    },
  ],
};

interface Cell {
  kind: CoverageKind;
  measured: number;
  minimum: number;
  found: number;
  hit: number;
  passed: boolean;
  /** How many more items must be covered to reach the floor. */
  missing: number;
}

interface Failure {
  scope: string;
  message: string;
  worstFiles: string[];
}

const percent = (value: number) => `${value.toFixed(2)}%`;

/** The files of the scope that leave the most items of one kind uncovered. */
function worstFiles(report: LcovReport, kind: CoverageKind, limit = 5): string[] {
  return [...report]
    .map(([file, values]) => ({
      file: file.replace(/\\/g, '/'),
      missed: [...values[kind].values()].filter((hits) => hits === 0).length,
    }))
    .filter((entry) => entry.missed > 0)
    .sort((left, right) => right.missed - left.missed)
    .slice(0, limit)
    .map((entry) => `${entry.file} (${entry.missed})`);
}

function measure(coverage: CoverageTotals, kind: CoverageKind, minimum: number): Cell {
  const [found, hit] = coverage[kind];
  const measured = coveragePercentage(coverage, kind) ?? 0;
  const required = Math.ceil((minimum / 100) * found - 1e-9);
  return {
    kind,
    measured,
    minimum,
    found,
    hit,
    passed: measured >= minimum,
    missing: Math.max(0, required - hit),
  };
}

function formatCell(cell: Cell): string {
  const text = `${percent(cell.measured)} / ${cell.minimum}%`;
  if (cell.passed) return `✓ ${text}`;
  return `✗ ${text}  (${(cell.measured - cell.minimum).toFixed(2)} pp)`;
}

function printTable(rows: { scope: string; cells: (Cell | string)[] }[]): void {
  const header = ['scope', ...COVERAGE_KINDS];
  const body = rows.map((row) => [
    row.scope,
    ...row.cells.map((cell) => (typeof cell === 'string' ? cell : formatCell(cell))),
  ]);
  const widths = header.map((title, index) =>
    Math.max(title.length, ...body.map((row) => row[index].length)),
  );
  const line = (cells: string[]) =>
    cells.map((cell, index) => cell.padEnd(widths[index])).join('   ');
  console.log(line(header));
  console.log(widths.map((width) => '─'.repeat(width)).join('───'));
  for (const row of body) console.log(line(row));
}

const project = process.argv[2];
const scopes = scopesByProject[project];
if (!scopes) {
  console.error(`Unknown scoped coverage project: ${project || '(missing)'}.`);
  process.exit(1);
}

const thresholds = JSON.parse(
  readFileSync(resolve(repoRoot, 'scripts/coverage-thresholds.json'), 'utf8'),
) as Record<string, Record<CoverageKind, number>>;

const rows: { scope: string; cells: (Cell | string)[] }[] = [];
const failures: Failure[] = [];

for (const scope of scopes) {
  const floors = thresholds[scope.threshold];
  if (!floors) {
    console.error(`${scope.threshold}: no floor in scripts/coverage-thresholds.json.`);
    process.exit(1);
  }

  const reports = scope.reports.map(([path, directory]) =>
    filterLcov(parseLcov(repoRoot, path, directory), scope.prefixes),
  );
  if (reports.some((report) => report === null)) {
    rows.push({ scope: scope.threshold, cells: COVERAGE_KINDS.map(() => '✗ report missing') });
    failures.push({
      scope: scope.threshold,
      message: 'the coverage report is missing: run the tests with coverage first.',
      worstFiles: [],
    });
    continue;
  }

  const merged = mergeLcovReports(reports);
  const coverage = mergeCoverage([merged]);
  const cells = COVERAGE_KINDS.map((kind) => measure(coverage, kind, floors[kind]));
  rows.push({ scope: scope.threshold, cells });

  for (const cell of cells.filter((entry) => !entry.passed)) {
    failures.push({
      scope: scope.threshold,
      message:
        `${cell.kind} ${percent(cell.measured)} is under the floor of ${cell.minimum}%: ` +
        `${cell.missing} more of ${cell.found} must be covered (${cell.hit}/${cell.found} now).`,
      worstFiles: worstFiles(merged, cell.kind),
    });
  }
}

console.log(`Scoped coverage floors - ${project}\n`);
printTable(rows);

if (failures.length === 0) {
  console.log('\nAll scopes are at or above their floors.');
} else {
  console.log(`\nFAILED: ${failures.length} below the floor`);
  for (const failure of failures) {
    console.log(`\n  ✗ ${failure.scope}: ${failure.message}`);
    if (failure.worstFiles.length > 0) {
      console.log('    most uncovered:');
      for (const file of failure.worstFiles) console.log(`      ${file}`);
    }
    if (process.env.GITHUB_ACTIONS) {
      console.log(
        `::error title=Coverage floor (${project})::${failure.scope}: ${failure.message}`,
      );
    }
  }
  process.exit(1);
}
