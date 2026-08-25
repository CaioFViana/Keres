import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type CoverageKind,
  type CoverageTotals,
  coveragePercentage,
  mergeCoverage,
  mergeLcovReports,
  parseLcov,
  serializeLcov,
} from './lib/coverage';
import { repoRoot } from './lib/packages';

/**
 * Runs every suite in the monorepo and prints a table: suites, tests, and coverage against each
 * project's floor.
 *
 * Needs the test infrastructure up (Postgres and SeaweedFS), because the API's coverage only
 * makes sense as the sum of its unit and integration suites.
 */
const TEST_COMPOSE = 'apps/api/docker-compose.test.yml';

type ProjectRun = [script: string, coverageDirectory: string];
const projects: [name: string, path: string, runs: ProjectRun[]][] = [
  ['shared', 'packages/shared', [['test:coverage', 'coverage']]],
  ['client', 'apps/client', [['test:coverage', 'coverage']]],
  [
    'api',
    'apps/api',
    [
      ['test:coverage', 'coverage'],
      ['test:integration:coverage', 'coverage-integration'],
    ],
  ],
  ['admin', 'apps/admin', [['test:coverage', 'coverage']]],
  ['desktop', 'apps/desktop', [['test:coverage', 'coverage']]],
  ['site', 'apps/site', [['test:coverage', 'coverage']]],
];

// The API ratchet applies to the union of the unit and integration suites, not to either report
// in isolation. The others mirror their own workspace's coverage configuration, so the report
// shows the same floors CI enforces.
const configuredThresholds = JSON.parse(
  readFileSync(resolve(repoRoot, 'scripts/coverage-thresholds.json'), 'utf8'),
) as Record<string, Record<CoverageKind, number>>;
const ratchets: Record<string, Record<CoverageKind, number> | undefined> = {
  shared: configuredThresholds.shared,
  client: configuredThresholds.client,
  api: configuredThresholds.apiCombined,
  admin: configuredThresholds.admin,
  desktop: configuredThresholds.desktop,
  site: configuredThresholds.site,
};

interface RunResult {
  code: number;
  output: string;
}

function run(command: string, args: string[]): Promise<RunResult> {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { cwd: repoRoot });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('close', (code) => resolveRun({ code: code ?? 1, output }));
  });
}

async function requireTestInfrastructure(): Promise<boolean> {
  const result = await run('docker', ['compose', '-f', TEST_COMPOSE, 'ps', '--format', 'json']);
  if (result.code !== 0) return false;
  const text = result.output.trim();
  if (!text) return false;

  let services: { Service?: string; State?: string; Health?: string }[];
  try {
    services = text.startsWith('[')
      ? JSON.parse(text)
      : text.split(/\r?\n/).map((line) => JSON.parse(line));
  } catch {
    return false;
  }
  return ['postgres-test', 's3-test'].every((service) =>
    services.some(
      (item) => item.Service === service && item.State === 'running' && item.Health === 'healthy',
    ),
  );
}

function parseTests(output: string): { suites: number; tests: number } {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI sequences from the runners' output
  const normalized = output.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
  const suites = [...normalized.matchAll(/(?:Test Files|Test Suites):?\s*(\d+)\s+passed/gi)].map(
    (match) => Number(match[1]),
  );
  const tests = [...normalized.matchAll(/^\s*Tests:?\s*(\d+)\s+passed/gim)].map((match) =>
    Number(match[1]),
  );
  return {
    suites: suites.reduce((total, value) => total + value, 0),
    tests: tests.reduce((total, value) => total + value, 0),
  };
}

function percent([found, hit]: [number, number]): string {
  return found === 0 ? '—' : `${((hit / found) * 100).toFixed(1)}%`;
}

function coverageWithRatchet(
  coverage: CoverageTotals | null,
  kind: CoverageKind,
  ratchet: Record<CoverageKind, number> | undefined,
): string {
  if (!coverage) return '—';
  const [found] = coverage[kind];
  if (found === 0) return '—';
  const value = coveragePercentage(coverage, kind) ?? 0;
  const minimum = ratchet?.[kind];
  if (minimum === undefined) return `${value.toFixed(1)}%`;
  const difference = value - minimum;
  const sign = difference >= 0 ? '+' : '';
  return `${percent(coverage[kind])} / ${minimum}% (${sign}${difference.toFixed(1)} pp)`;
}

function meetsRatchet(
  coverage: CoverageTotals,
  ratchet: Record<CoverageKind, number> | undefined,
): boolean {
  return (
    !ratchet ||
    Object.entries(ratchet).every(([kind, minimum]) => {
      const value = coveragePercentage(coverage, kind as CoverageKind);
      return value !== null && value >= minimum;
    })
  );
}

function printTable(rows: string[][]): void {
  const headers = ['Project', 'Status', 'Suites', 'Tests', 'Lines', 'Functions', 'Branches'];
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length)),
  );
  const border = `+-${widths.map((width) => '-'.repeat(width)).join('-+-')}-+`;
  const format = (row: string[]) =>
    `| ${row
      .map((cell, index) => (index < 2 ? cell.padEnd(widths[index]) : cell.padStart(widths[index])))
      .join(' | ')} |`;
  console.log(`\n${border}`);
  console.log(format(headers));
  console.log(border);
  rows.forEach((row) => console.log(format(row)));
  console.log(border);
}

if (!(await requireTestInfrastructure())) {
  console.error(
    `Test infrastructure unavailable. Start Postgres and SeaweedFS with:\n  docker compose -f ${TEST_COMPOSE} up -d`,
  );
  process.exit(1);
}

interface ProjectResult {
  name: string;
  code: number;
  output: string;
  tests: { suites: number; tests: number };
  coverage: CoverageTotals | null;
  ratchetFailure: boolean;
}

const results: ProjectResult[] = [];
for (const [name, path, runs] of projects) {
  process.stdout.write(`Running ${name}... `);
  const executions: (RunResult & { coverageDirectory: string })[] = [];
  for (const [script, coverageDirectory] of runs) {
    const result = await run('bun', ['run', '--cwd', path, script]);
    executions.push({ ...result, coverageDirectory });
    if (result.code !== 0) break;
  }

  const output = executions.map((result) => result.output).join('\n');
  const code = executions.some((result) => result.code !== 0) ? 1 : 0;
  const coverage =
    code === 0
      ? mergeCoverage(
          executions.map((result) => parseLcov(repoRoot, path, result.coverageDirectory)),
        )
      : null;
  const ratchetFailure = Boolean(coverage && !meetsRatchet(coverage, ratchets[name]));
  const finalCode = code || ratchetFailure ? 1 : 0;

  results.push({
    name,
    code: finalCode,
    output,
    tests: parseTests(output),
    coverage,
    ratchetFailure,
  });
  console.log(finalCode === 0 ? 'ok' : ratchetFailure ? 'below the ratchet' : 'failed');
}

printTable(
  results.map((result) => [
    result.name,
    result.code === 0 ? '✓' : '✗',
    String(result.tests.suites || '—'),
    String(result.tests.tests || '—'),
    coverageWithRatchet(result.coverage, 'lines', ratchets[result.name]),
    coverageWithRatchet(result.coverage, 'functions', ratchets[result.name]),
    coverageWithRatchet(result.coverage, 'branches', ratchets[result.name]),
  ]),
);

const failed = results.filter((result) => result.code !== 0);

const apiResult = results.find((result) => result.name === 'api');
if (apiResult?.code === 0) {
  const apiReports = [
    parseLcov(repoRoot, 'apps/api', 'coverage'),
    parseLcov(repoRoot, 'apps/api', 'coverage-integration'),
  ];
  const outputDirectory = resolve(repoRoot, 'apps/api/coverage-combined');
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    resolve(outputDirectory, 'lcov.info'),
    serializeLcov(mergeLcovReports(apiReports)),
    'utf8',
  );
}

if (failed.length) {
  console.error('\nFailures (last lines of each output):');
  for (const result of failed) {
    const message = result.ratchetFailure
      ? `Coverage below the ratchet: ${JSON.stringify(ratchets[result.name])}`
      : result.output.trim().split(/\r?\n/).slice(-30).join('\n');
    console.error(`\n[${result.name}]\n${message}`);
  }
  process.exitCode = 1;
}
