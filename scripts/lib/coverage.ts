import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const COVERAGE_KINDS = ['lines', 'functions', 'branches'] as const;
export type CoverageKind = (typeof COVERAGE_KINDS)[number];

/** One file's counts: item key (line, function, branch) to number of executions. */
interface FileCoverage extends Record<CoverageKind, Map<string, number>> {
  functionLines: Map<string, number>;
}
export type LcovReport = Map<string, FileCoverage>;

/** Whole-project totals: `[found, covered]` per kind. */
export type CoverageTotals = Record<CoverageKind, [number, number]>;

const emptyFileCoverage = (): FileCoverage => ({
  lines: new Map(),
  functions: new Map(),
  branches: new Map(),
  functionLines: new Map(),
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
    } else if (current && line.startsWith('FN:')) {
      const separator = line.indexOf(',', 3);
      if (separator !== -1) {
        current.functionLines.set(line.slice(separator + 1), Number(line.slice(3, separator)));
      }
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
 * Merges reports from the same project by source location.
 *
 * The API has two suites (unit and integration) covering the same files: adding both lcov files
 * would count every line twice. Here the highest count for each item wins.
 */
export function mergeCoverage(reports: (LcovReport | null)[]): CoverageTotals {
  const merged = mergeLcovReports(reports);

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

/** Merges reports from separate suites without counting the same source location twice. */
export function mergeLcovReports(reports: (LcovReport | null)[]): LcovReport {
  const merged: LcovReport = new Map();
  for (const report of reports) {
    if (!report) continue;
    for (const [file, values] of report) {
      const target = merged.get(file) ?? emptyFileCoverage();
      merged.set(file, target);
      for (const [name, line] of values.functionLines) target.functionLines.set(name, line);
      for (const kind of COVERAGE_KINDS) {
        for (const [key, hits] of values[kind]) {
          target[kind].set(key, Math.max(target[kind].get(key) ?? 0, hits));
        }
      }
    }
  }

  return merged;
}

/** Keeps only source files under one of the normalized repository-relative prefixes. */
export function filterLcov(report: LcovReport | null, prefixes: string[]): LcovReport | null {
  if (!report) return null;
  const normalizedPrefixes = prefixes.map((prefix) => prefix.replace(/\\/g, '/'));
  return new Map(
    [...report].filter(([file]) => {
      const normalizedFile = file.replace(/\\/g, '/');
      return normalizedPrefixes.some((prefix) => normalizedFile.startsWith(prefix));
    }),
  );
}

/** Serializes a merged report into a regular LCOV file consumable by editors and CI services. */
export function serializeLcov(report: LcovReport): string {
  const output: string[] = ['TN:'];
  for (const [file, values] of [...report].sort(([left], [right]) => left.localeCompare(right))) {
    output.push(`SF:${file}`);
    for (const [name, line] of values.functionLines) output.push(`FN:${line},${name}`);
    for (const [name, hits] of values.functions) output.push(`FNDA:${hits},${name}`);
    output.push(`FNF:${values.functions.size}`);
    output.push(`FNH:${[...values.functions.values()].filter((hits) => hits > 0).length}`);
    for (const [key, hits] of values.branches) {
      const [line, block, branch] = key.split(':');
      output.push(`BRDA:${line},${block},${branch},${hits}`);
    }
    output.push(`BRF:${values.branches.size}`);
    output.push(`BRH:${[...values.branches.values()].filter((hits) => hits > 0).length}`);
    for (const [line, hits] of values.lines) output.push(`DA:${line},${hits}`);
    output.push(`LF:${values.lines.size}`);
    output.push(`LH:${[...values.lines.values()].filter((hits) => hits > 0).length}`);
    output.push('end_of_record');
  }
  return `${output.join('\n')}\n`;
}

export function coveragePercentage(coverage: CoverageTotals, kind: CoverageKind): number | null {
  const [found, hit] = coverage[kind];
  return found === 0 ? null : (hit / found) * 100;
}
