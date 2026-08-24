import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const COVERAGE_KINDS = ['lines', 'functions', 'branches'];

export function parseLcov(root, projectPath, coverageDirectory) {
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

export function mergeCoverage(reports) {
  const merged = new Map();
  for (const report of reports.filter(Boolean)) {
    for (const [file, values] of report) {
      const target = merged.get(file) ?? {
        lines: new Map(),
        functions: new Map(),
        branches: new Map(),
      };
      merged.set(file, target);
      for (const kind of COVERAGE_KINDS) {
        for (const [key, hits] of values[kind])
          target[kind].set(key, Math.max(target[kind].get(key) ?? 0, hits));
      }
    }
  }
  const total = (kind) => {
    let found = 0;
    let hit = 0;
    for (const values of merged.values())
      for (const count of values[kind].values()) {
        found++;
        if (count > 0) hit++;
      }
    return [found, hit];
  };
  return { lines: total('lines'), functions: total('functions'), branches: total('branches') };
}

export function coveragePercentage(coverage, kind) {
  const [found, hit] = coverage[kind];
  return found === 0 ? null : (hit / found) * 100;
}
