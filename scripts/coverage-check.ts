import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COVERAGE_KINDS,
  type CoverageKind,
  coveragePercentage,
  filterLcov,
  mergeCoverage,
  parseLcov,
} from './lib/coverage';
import { repoRoot } from './lib/packages';

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
        'src/services/SyncEngineService.ts',
        'src/services/SyncConflictService.ts',
        'src/services/ConflictSummaryService.ts',
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
      prefixes: ['src/services/SyncService.ts'],
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
      prefixes: ['src/services/StoryExportImportService.ts'],
    },
  ],
};

const project = process.argv[2];
const scopes = scopesByProject[project];
if (!scopes) {
  console.error(`Unknown scoped coverage project: ${project || '(missing)'}.`);
  process.exit(1);
}

const thresholds = JSON.parse(
  readFileSync(resolve(repoRoot, 'scripts/coverage-thresholds.json'), 'utf8'),
) as Record<string, Record<CoverageKind, number>>;

let failed = false;
for (const scope of scopes) {
  const reports = scope.reports.map(([path, directory]) =>
    filterLcov(parseLcov(repoRoot, path, directory), scope.prefixes),
  );
  if (reports.some((report) => report === null)) {
    console.error(`${scope.threshold}: coverage report is missing.`);
    failed = true;
    continue;
  }

  const coverage = mergeCoverage(reports);
  const details = COVERAGE_KINDS.map((kind) => {
    const measured = coveragePercentage(coverage, kind) ?? 0;
    const minimum = thresholds[scope.threshold][kind];
    if (measured < minimum) failed = true;
    return `${kind} ${measured.toFixed(2)}% / ${minimum}%`;
  });
  console.log(`${scope.threshold}: ${details.join(' | ')}`);
}

if (failed) process.exit(1);
