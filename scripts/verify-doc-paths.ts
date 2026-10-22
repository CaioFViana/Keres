import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Audits the repository's markdown against the tree: every file or folder a document names in backticks, and
 * every relative link, has to exist. The documents are the map a newcomer navigates by, and they go stale
 * the quiet way - a file is renamed or moved, the code is fixed, and the sentence that points at it stays
 * (the docs reorganization of October 2026 repointed dozens of these by hand).
 *
 * What counts as a path: a backticked span with no spaces that ends in a known file extension, or that
 * starts at a known top-level folder and ends in `/`. Spans with `<placeholders>`, `*` globs, `...` or `{}` are
 * patterns, not paths. A path written as `src/services/...` is relative to a workspace, so it passes when
 * it exists under the repository root or under any `apps/*` or `packages/*` workspace.
 *
 * "Exists" means the repository has it: a tracked file or folder, not whatever happens to be on the disk of the one
 * machine running the check (a local-only plan under `.agents/`, an old build output), or the result would depend on the
 * machine. The one exception is a build output folder (`dist`, `dist-server`...): a document may say where a build
 * writes, and that folder is ignored by git by design.
 *
 * Plans under `docs/decisions/` and `docs/extras/` are history: they describe the code as it was when they
 * were written, so they are not held to this.
 */

const ROOT = path.resolve(__dirname, '..');
const EXTENSIONS = /\.(ts|tsx|js|cjs|mjs|json|md|yml|yaml|sql|sh|css|html|png|svg|toml|ttf|webp)$/;
const TOP_FOLDERS = /^(apps|packages|docs|scripts|src|test|\.github)\//;
const HISTORY = [path.join('docs', 'decisions'), path.join('docs', 'extras')];

/** The documents a newcomer reads: the root ones, everything under docs/, and each workspace's own README. */
function markdownFiles(): string[] {
  const out: string[] = [];
  const addFolder = (dir: string, recursive: boolean) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) addFolder(full, true);
      } else if (entry.name.endsWith('.md')) out.push(full);
    }
  };
  addFolder(ROOT, false);
  addFolder(path.join(ROOT, 'docs'), true);
  for (const group of ['apps', 'packages']) {
    const base = path.join(ROOT, group);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) addFolder(path.join(base, name), false);
  }
  return out;
}

/** Where a shortened path may start: the repository, `docs/`, and each workspace and its `src/`. */
function workspaceRoots(): string[] {
  const roots = [ROOT, path.join(ROOT, 'docs')];
  for (const group of ['apps', 'packages']) {
    const base = path.join(ROOT, group);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base))
      roots.push(path.join(base, name), path.join(base, name, 'src'));
  }
  return roots;
}

const ROOTS = workspaceRoots();

const TRACKED = new Set(
  execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\n')
    .filter(Boolean),
);

function isTracked(repoRelative: string): boolean {
  const key = repoRelative.split(path.sep).join('/').replace(/\/$/, '');
  if (TRACKED.has(key)) return true;
  const prefix = `${key}/`;
  for (const file of TRACKED) if (file.startsWith(prefix)) return true;
  return false;
}

/** A path through a build output folder: ignored by git on purpose, and absent from a fresh checkout. */
const isBuildOutput = (repoRelative: string) =>
  repoRelative.split(/[\\/]/).some((segment) => /^dist(-[\w-]+)?$/.test(segment));

function exists(candidate: string, from: string): boolean {
  const clean = candidate.replace(/[#?].*$/, '').replace(/:\d+(-\d+)?$/, '');
  if (!clean) return true;
  const bases = [path.dirname(from), ...ROOTS];
  return bases.some((base) => {
    const repoRelative = path.relative(ROOT, path.resolve(base, clean));
    if (repoRelative.startsWith('..')) return false;
    return isTracked(repoRelative) || isBuildOutput(repoRelative);
  });
}

function looksLikePath(span: string): boolean {
  if (/\s/.test(span) || /[<>*{}$|]/.test(span) || span.includes('...')) return false;
  if (/^[a-z]+:\/\//.test(span) || span.startsWith('@') || span.startsWith('~')) return false;
  const base = span.replace(/:\d+(-\d+)?$/, '');
  if (base.endsWith('/')) return TOP_FOLDERS.test(base);
  return base.includes('/') ? EXTENSIONS.test(base) : false;
}

const problems: string[] = [];
for (const file of markdownFiles()) {
  const rel = path.relative(ROOT, file);
  if (HISTORY.some((folder) => rel.startsWith(folder))) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let inFence = false;
  lines.forEach((line, index) => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const span = match[1];
      if (looksLikePath(span) && !exists(span, file)) {
        problems.push(`${rel}:${index + 1}: \`${span}\` does not exist`);
      }
    }
    for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1];
      if (/^[a-z]+:/.test(target) || target.startsWith('#')) continue;
      if (!exists(target, file))
        problems.push(`${rel}:${index + 1}: link (${target}) does not exist`);
    }
  });
}

if (problems.length > 0) {
  console.error(`${problems.length} document reference(s) point at nothing:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('Every path and link named in the documents exists.');
