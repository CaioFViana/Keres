import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const COVERAGE_KINDS = ['lines', 'functions', 'branches'] as const;
export type CoverageKind = (typeof COVERAGE_KINDS)[number];

/** Contagens de um arquivo: chave do item (linha, função, ramo) para número de execuções. */
type FileCoverage = Record<CoverageKind, Map<string, number>>;
export type LcovReport = Map<string, FileCoverage>;

/** Totais do projeto inteiro: `[encontrados, cobertos]` por tipo. */
export type CoverageTotals = Record<CoverageKind, [number, number]>;

const emptyFileCoverage = (): FileCoverage => ({
  lines: new Map(),
  functions: new Map(),
  branches: new Map(),
});

export function parseLcov(
  root: string,
  projectPath: string,
  coverageDirectory: string,
): LcovReport | null {
  const file = resolve(root, projectPath, coverageDirectory, 'lcov.info');
  if (!existsSync(file)) return null;

  const files: LcovReport = new Map();
  let current: FileCoverage | undefined;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      current = emptyFileCoverage();
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

/**
 * Junta relatórios do mesmo projeto por localização no código.
 *
 * A API tem duas suítes (unitária e de integração) cobrindo os mesmos arquivos: somar os dois
 * lcov contaria cada linha duas vezes. Aqui vale a maior contagem de cada item.
 */
export function mergeCoverage(reports: (LcovReport | null)[]): CoverageTotals {
  const merged: LcovReport = new Map();
  for (const report of reports) {
    if (!report) continue;
    for (const [file, values] of report) {
      const target = merged.get(file) ?? emptyFileCoverage();
      merged.set(file, target);
      for (const kind of COVERAGE_KINDS) {
        for (const [key, hits] of values[kind]) {
          target[kind].set(key, Math.max(target[kind].get(key) ?? 0, hits));
        }
      }
    }
  }

  const total = (kind: CoverageKind): [number, number] => {
    let found = 0;
    let hit = 0;
    for (const values of merged.values()) {
      for (const count of values[kind].values()) {
        found++;
        if (count > 0) hit++;
      }
    }
    return [found, hit];
  };

  return { lines: total('lines'), functions: total('functions'), branches: total('branches') };
}

export function coveragePercentage(coverage: CoverageTotals, kind: CoverageKind): number | null {
  const [found, hit] = coverage[kind];
  return found === 0 ? null : (hit / found) * 100;
}
