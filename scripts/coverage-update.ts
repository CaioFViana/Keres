import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COVERAGE_KINDS,
  coveragePercentage,
  filterLcov,
  mergeCoverage,
  parseLcov,
} from './lib/coverage';
import { repoRoot } from './lib/packages';

/**
 * Raises the coverage floors to whatever the last measurement reached.
 *
 *   bun run coverage:update                     raise whatever can be raised
 *   bun run coverage:update --rebaseline        also accept lowering a floor that no longer passes
 *   bun run coverage:update --project client    a single project
 *
 * Reads the `lcov.info` files `bun run test:report` left behind; run that one first.
 */
const thresholdsFile = resolve(repoRoot, 'scripts/coverage-thresholds.json');
type Thresholds = Record<string, Record<string, number>> & {
  _meta: { safetyMarginPercentagePoints: number };
};
const thresholds = JSON.parse(readFileSync(thresholdsFile, 'utf8')) as Thresholds;

const rebaseline = process.argv.includes('--rebaseline');
const projectArgumentIndex = process.argv.indexOf('--project');
const selectedProject =
  projectArgumentIndex === -1 ? null : process.argv[projectArgumentIndex + 1]?.trim();

/** Where each floor's lcov lives. The API has three: unit, integration, and the union of both. */
const reports: Record<string, [string, string][]> = {
  shared: [['packages/shared', 'coverage']],
  client: [['apps/client', 'coverage']],
  apiUnit: [['apps/api', 'coverage']],
  apiIntegration: [['apps/api', 'coverage-integration']],
  apiCombined: [
    ['apps/api', 'coverage'],
    ['apps/api', 'coverage-integration'],
  ],
  admin: [['apps/admin', 'coverage']],
  desktop: [['apps/desktop', 'coverage']],
  site: [['apps/site', 'coverage']],
};

const scopedReports: Record<string, { reports: [string, string][]; prefixes: string[] }> = {
  clientSyncCore: {
    reports: reports.client,
    prefixes: [
      'src/services/sync/',
      'src/services/SyncEngineService.ts',
      'src/services/SyncConflictService.ts',
      'src/services/ConflictSummaryService.ts',
    ],
  },
  clientSyncHandlers: {
    reports: reports.client,
    prefixes: ['src/services/entity-sync-handlers/'],
  },
  clientStoryServices: {
    reports: reports.client,
    prefixes: ['src/services/storymanagement/'],
  },
  apiSyncCore: {
    reports: reports.apiCombined,
    prefixes: ['src/services/SyncService.ts'],
  },
  apiSyncHandlers: {
    reports: reports.apiCombined,
    prefixes: ['src/services/entity-sync-handlers/'],
  },
  apiExportImport: {
    reports: reports.apiCombined,
    prefixes: ['src/services/StoryExportImportService.ts'],
  },
};

const allReports: Record<string, { reports: [string, string][]; prefixes?: string[] }> = {
  ...Object.fromEntries(
    Object.entries(reports).map(([name, sources]) => [name, { reports: sources }]),
  ),
  ...scopedReports,
};

if (selectedProject && !allReports[selectedProject]) {
  console.error(
    `Unknown project: ${selectedProject}. Options: ${Object.keys(allReports).join(', ')}`,
  );
  process.exit(1);
}

const margin = thresholds._meta.safetyMarginPercentagePoints;
const names = selectedProject ? [selectedProject] : Object.keys(allReports);
let changed = false;

for (const name of names) {
  const reportDefinition = allReports[name];
  const parsedReports = reportDefinition.reports.map(([projectPath, directory]) => {
    const report = parseLcov(repoRoot, projectPath, directory);
    return reportDefinition.prefixes ? filterLcov(report, reportDefinition.prefixes) : report;
  });
  if (parsedReports.some((report) => report === null)) {
    console.error(`No coverage for ${name}. Run bun run test:report before updating the floors.`);
    process.exitCode = 1;
    continue;
  }

  const coverage = mergeCoverage(parsedReports);
  const next = { ...thresholds[name] };
  const details: string[] = [];
  for (const kind of COVERAGE_KINDS) {
    const measured = coveragePercentage(coverage, kind);
    if (measured === null) {
      console.error(`${name} has no measurable points for ${kind}.`);
      process.exitCode = 1;
      continue;
    }
    // One decimal place avoids losing almost another whole point beyond the agreed margin.
    const candidate = Math.max(0, Math.floor((measured - margin) * 10) / 10);
    // Rebaselining only lowers a floor the current measurement already violates. Metrics that
    // still pass keep the ratchet they earned, even during an explicit recalibration.
    const current = thresholds[name][kind];
    next[kind] = rebaseline && current > measured ? candidate : Math.max(current, candidate);
    details.push(`${kind} ${measured.toFixed(2)}% → floor ${next[kind]}%`);
  }

  if (JSON.stringify(next) !== JSON.stringify(thresholds[name])) {
    thresholds[name] = next;
    changed = true;
  }
  console.log(`${name}: ${details.join(' | ')}`);
}

if (process.exitCode) process.exit();

if (!changed) {
  console.log('No floor needed changing.');
  process.exit();
}

writeFileSync(thresholdsFile, `${JSON.stringify(thresholds, null, 2)}\n`, 'utf8');
console.log(
  rebaseline
    ? 'Floors recalculated, explicit baseline reductions included.'
    : 'Ratchet updated; no existing floor was lowered.',
);
