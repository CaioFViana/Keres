import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const TEST_COMPOSE = 'apps/api/docker-compose.test.yml';

/** API is one project: unit and integration coverage are merged by source location. */
const projects = [
  ['shared', 'packages/shared', [['test:coverage', 'coverage']]],
  ['client', 'apps/client', [['test:coverage', 'coverage']]],
  ['api', 'apps/api', [['test:coverage', 'coverage'], ['test:integration:coverage', 'coverage-integration']]],
  ['admin', 'apps/admin', [['test:coverage', 'coverage']]],
  ['desktop', 'apps/desktop', [['test:coverage', 'coverage']]],
];

// The API ratchet applies to the union of unit and integration coverage, not either
// report in isolation. The individual Vitest configs keep their own ratchets too.
const mergedRatchets = {
  api: { lines: 74, functions: 75, branches: 60 },
};

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { cwd: root });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (code) => resolveRun({ code: code ?? 1, output }));
  });
}

async function requireTestInfrastructure() {
  const result = await run('docker', ['compose', '-f', TEST_COMPOSE, 'ps', '--format', 'json']);
  if (result.code !== 0) return false;
  const text = result.output.trim();
  if (!text) return false;
  let services;
  try {
    services = text.startsWith('[') ? JSON.parse(text) : text.split(/\r?\n/).map((line) => JSON.parse(line));
  } catch {
    return false;
  }
  return ['postgres-test', 's3-test'].every((service) => services.some((item) =>
    item.Service === service && item.State === 'running' && item.Health === 'healthy',
  ));
}

function parseTests(output) {
  const normalized = output.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
  const values = [...normalized.matchAll(/(?:Test Files|Test Suites):?\s*(\d+)\s+passed/gi)].map((match) => Number(match[1]));
  const tests = [...normalized.matchAll(/^\s*Tests:?\s*(\d+)\s+passed/img)].map((match) => Number(match[1]));
  return { suites: values.reduce((total, value) => total + value, 0), tests: tests.reduce((total, value) => total + value, 0) };
}

function parseLcov(projectPath, coverageDirectory) {
  const file = resolve(root, projectPath, coverageDirectory, 'lcov.info');
  if (!existsSync(file)) return null;
  const files = new Map();
  let current;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      current = { lines: new Map(), functions: new Map(), branches: new Map() };
      files.set(line.slice(3), current);
    } else if (current && line.startsWith('DA:')) {
      const [lineNumber, hits] = line.slice(3).split(',');
      current.lines.set(lineNumber, Number(hits));
    } else if (current && line.startsWith('FNDA:')) {
      const [hits, name] = line.slice(5).split(',');
      current.functions.set(name, Number(hits));
    } else if (current && line.startsWith('BRDA:')) {
      const [lineNumber, block, branch, hits] = line.slice(5).split(',');
      current.branches.set(`${lineNumber}:${block}:${branch}`, hits === '-' ? 0 : Number(hits));
    }
  }
  return files;
}

function mergeCoverage(reports) {
  const merged = new Map();
  for (const report of reports.filter(Boolean)) {
    for (const [file, values] of report) {
      const target = merged.get(file) ?? { lines: new Map(), functions: new Map(), branches: new Map() };
      merged.set(file, target);
      for (const kind of ['lines', 'functions', 'branches']) {
        for (const [key, hits] of values[kind]) target[kind].set(key, Math.max(target[kind].get(key) ?? 0, hits));
      }
    }
  }
  const total = (kind) => {
    let found = 0;
    let hit = 0;
    for (const values of merged.values()) for (const count of values[kind].values()) { found++; if (count > 0) hit++; }
    return [found, hit];
  };
  return { lines: total('lines'), functions: total('functions'), branches: total('branches') };
}

function percent([found, hit]) {
  return found === 0 ? '—' : `${((hit / found) * 100).toFixed(1)}%`;
}

function meetsRatchet(coverage, ratchet) {
  return !ratchet || Object.entries(ratchet).every(([kind, minimum]) => {
    const [found, hit] = coverage[kind];
    return found > 0 && (hit / found) * 100 >= minimum;
  });
}

function printTable(rows) {
  const headers = ['Projeto', 'Status', 'Suites', 'Testes', 'Linhas', 'Funções', 'Branches'];
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index].length)));
  const border = `+-${widths.map((width) => '-'.repeat(width)).join('-+-')}-+`;
  const format = (row) => `| ${row.map((cell, index) => (index < 2 ? cell.padEnd(widths[index]) : cell.padStart(widths[index]))).join(' | ')} |`;
  console.log(`\n${border}`);
  console.log(format(headers));
  console.log(border);
  rows.forEach((row) => console.log(format(row)));
  console.log(border);
}

if (!await requireTestInfrastructure()) {
  console.error(`Infraestrutura de teste indisponível. Suba Postgres e SeaweedFS com:\n  docker compose -f ${TEST_COMPOSE} up -d`);
  process.exit(1);
}

const results = [];
for (const [name, path, commands] of projects) {
  process.stdout.write(`Executando ${name}... `);
  const executions = [];
  for (const [script, coverageDirectory] of commands) {
    const result = await run('bun', ['run', '--cwd', path, script]);
    executions.push({ ...result, coverageDirectory });
    if (result.code !== 0) break;
  }
  const output = executions.map((result) => result.output).join('\n');
  const code = executions.some((result) => result.code !== 0) ? 1 : 0;
  const coverage = code === 0 ? mergeCoverage(executions.map((result) => parseLcov(path, result.coverageDirectory))) : null;
  const ratchetFailure = coverage && !meetsRatchet(coverage, mergedRatchets[name]);
  const finalCode = code || ratchetFailure ? 1 : 0;
  results.push({ name, code: finalCode, output, tests: parseTests(output), coverage, ratchetFailure });
  console.log(finalCode === 0 ? 'ok' : ratchetFailure ? 'abaixo do ratchet' : 'falhou');
}

printTable(results.map((result) => [
  result.name,
  result.code === 0 ? '✓' : '✗',
  String(result.tests.suites || '—'),
  String(result.tests.tests || '—'),
  result.coverage ? percent(result.coverage.lines) : '—',
  result.coverage ? percent(result.coverage.functions) : '—',
  result.coverage ? percent(result.coverage.branches) : '—',
]));

const failed = results.filter((result) => result.code !== 0);
if (failed.length) {
  console.error('\nFalhas (últimas linhas de cada saída):');
  for (const result of failed) {
    const message = result.ratchetFailure
      ? `Cobertura agregada abaixo do ratchet: ${JSON.stringify(mergedRatchets[result.name])}`
      : result.output.trim().split(/\r?\n/).slice(-30).join('\n');
    console.error(`\n[${result.name}]\n${message}`);
  }
  process.exitCode = 1;
}
