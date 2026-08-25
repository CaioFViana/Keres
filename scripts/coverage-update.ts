import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COVERAGE_KINDS, coveragePercentage, mergeCoverage, parseLcov } from './lib/coverage';
import { repoRoot } from './lib/packages';

/**
 * Sobe os pisos de cobertura até o que a última medição alcançou.
 *
 *   bun run coverage:update                     sobe o que dá para subir
 *   bun run coverage:update --rebaseline        aceita também baixar um piso que já não passa
 *   bun run coverage:update --project client    só um projeto
 *
 * Lê os `lcov.info` que `bun run test:report` deixou; rode aquele antes.
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

/** Onde mora o lcov de cada piso. A API tem três: unitário, integração e a união dos dois. */
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

if (selectedProject && !reports[selectedProject]) {
  console.error(
    `Projeto desconhecido: ${selectedProject}. Opções: ${Object.keys(reports).join(', ')}`,
  );
  process.exit(1);
}

const margin = thresholds._meta.safetyMarginPercentagePoints;
const names = selectedProject ? [selectedProject] : Object.keys(reports);
let changed = false;

for (const name of names) {
  const parsedReports = reports[name].map(([projectPath, directory]) =>
    parseLcov(repoRoot, projectPath, directory),
  );
  if (parsedReports.some((report) => report === null)) {
    console.error(
      `Cobertura ausente para ${name}. Execute bun run test:report antes de atualizar os pisos.`,
    );
    process.exitCode = 1;
    continue;
  }

  const coverage = mergeCoverage(parsedReports);
  const next = { ...thresholds[name] };
  const details: string[] = [];
  for (const kind of COVERAGE_KINDS) {
    const measured = coveragePercentage(coverage, kind);
    if (measured === null) {
      console.error(`${name} não possui pontos mensuráveis para ${kind}.`);
      process.exitCode = 1;
      continue;
    }
    // Uma casa decimal evita perder quase outro ponto inteiro além da margem acordada.
    const candidate = Math.max(0, Math.floor((measured - margin) * 10) / 10);
    // Rebaseline só reduz um piso que a medição atual já viola. Métricas que continuam
    // passando preservam o ratchet conquistado, mesmo durante uma recalibração explícita.
    const current = thresholds[name][kind];
    next[kind] = rebaseline && current > measured ? candidate : Math.max(current, candidate);
    details.push(`${kind} ${measured.toFixed(2)}% → piso ${next[kind]}%`);
  }

  if (JSON.stringify(next) !== JSON.stringify(thresholds[name])) {
    thresholds[name] = next;
    changed = true;
  }
  console.log(`${name}: ${details.join(' | ')}`);
}

if (process.exitCode) process.exit();

if (!changed) {
  console.log('Nenhum piso precisava ser alterado.');
  process.exit();
}

writeFileSync(thresholdsFile, `${JSON.stringify(thresholds, null, 2)}\n`, 'utf8');
console.log(
  rebaseline
    ? 'Pisos recalculados, inclusive reduções explícitas de baseline.'
    : 'Ratchet atualizado; nenhum piso existente foi reduzido.',
);
