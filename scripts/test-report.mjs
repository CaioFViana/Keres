import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

/**
 * `[rótulo, workspace, script, diretório de cobertura]`.
 *
 * A integração da API entra como linha própria: é o que de fato exercita rotas, serviços e
 * handlers, e deixá-la de fora faria a API parecer descoberta. Escreve a cobertura num
 * diretório separado para não sobrescrever a das suítes unitárias.
 */
const projects = [
  ['shared', 'packages/shared', 'test:coverage', 'coverage'],
  ['client', 'apps/client', 'test:coverage', 'coverage'],
  ['api', 'apps/api', 'test:coverage', 'coverage'],
  ['api (integração)', 'apps/api', 'test:integration:coverage', 'coverage-integration'],
  ['admin', 'apps/admin', 'test:coverage', 'coverage'],
  ['desktop', 'apps/desktop', 'test:coverage', 'coverage'],
];

/** A suíte de integração exige o Postgres descartável; sem ele a falha é de infra, não de código. */
const DATABASE_HINT = 'docker compose -f apps/api/docker-compose.test.yml up -d';

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { cwd: root });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (code) => resolveRun({ code: code ?? 1, output }));
  });
}

function parseTests(output) {
  const normalized = output.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
  const value = (pattern) => Number(normalized.match(pattern)?.[1] ?? 0);
  return {
    suites: value(/(?:Test Files|Test Suites):?\s*(\d+)\s+passed/i),
    tests: value(/^\s*Tests:\s*(\d+)\s+passed/im) || value(/^\s*Tests\s+(\d+)\s+passed/im),
  };
}

function parseLcov(projectPath, coverageDirectory = 'coverage') {
  const file = resolve(root, projectPath, coverageDirectory, 'lcov.info');
  if (!existsSync(file)) return null;

  const totals = { lines: [0, 0], functions: [0, 0], branches: [0, 0] };
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^(LF|LH|FNF|FNH|BRF|BRH):(\d+)$/.exec(line);
    if (!match) continue;
    const key = { LF: 'lines', LH: 'lines', FNF: 'functions', FNH: 'functions', BRF: 'branches', BRH: 'branches' }[match[1]];
    totals[key][match[1].endsWith('H') ? 1 : 0] += Number(match[2]);
  }
  return totals;
}

function percent([found, hit]) {
  return found === 0 ? '—' : `${((hit / found) * 100).toFixed(1)}%`;
}

function printTable(rows) {
  const headers = ['Projeto', 'Status', 'Suites', 'Testes', 'Linhas', 'Funções', 'Branches'];
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => row[index].length),
  ));
  const border = `+-${widths.map((width) => '-'.repeat(width)).join('-+-')}-+`;
  const format = (row) => `| ${row.map((cell, index) => (
    index < 2 ? cell.padEnd(widths[index]) : cell.padStart(widths[index])
  )).join(' | ')} |`;

  console.log(`\n${border}`);
  console.log(format(headers));
  console.log(border);
  rows.forEach((row) => console.log(format(row)));
  console.log(border);
}

const results = [];
for (const [name, path, script, coverageDirectory] of projects) {
  process.stdout.write(`Executando ${name}... `);
  const result = await run('bun', ['run', '--cwd', path, script]);
  const tests = parseTests(result.output);
  // Só usa o artefato gerado nesta execução; caso contrário um lcov antigo
  // poderia fazer uma suíte que falhou parecer saudável.
  const coverage = result.code === 0 ? parseLcov(path, coverageDirectory) : null;
  const needsDatabase = result.code !== 0 && /Não foi possível preparar o banco de teste/.test(result.output);
  results.push({ name, path, ...result, tests, coverage, needsDatabase });
  console.log(result.code === 0 ? 'ok' : needsDatabase ? 'sem banco' : 'falhou');
}

const rows = results.map((result) => {
  const c = result.coverage;
  return [
    result.name,
    result.code === 0 ? '✓' : result.needsDatabase ? '—' : '✗',
    String(result.tests.suites || '—'),
    String(result.tests.tests || '—'),
    c ? percent(c.lines) : '—',
    c ? percent(c.functions) : '—',
    c ? percent(c.branches) : '—',
  ];
});
printTable(rows);

const skipped = results.filter((result) => result.needsDatabase);
if (skipped.length) {
  console.log(`\n${skipped.map((result) => result.name).join(', ')}: banco de teste indisponível.`);
  console.log(`Suba-o com: ${DATABASE_HINT}`);
}

// Banco fora do ar não é falha de código: não derruba o relatório inteiro.
const failed = results.filter((result) => result.code !== 0 && !result.needsDatabase);
if (failed.length) {
  console.error('\nFalhas (últimas linhas de cada saída):');
  for (const result of failed) {
    console.error(`\n[${result.name}]\n${result.output.trim().split(/\r?\n/).slice(-30).join('\n')}`);
  }
  process.exitCode = 1;
}
