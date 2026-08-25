import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface Package {
  /** Short name, as it shows up in reports and in the root scripts (`api:start`). */
  name: string;
  /** Path from the repository root. */
  path: string;
}

/**
 * The monorepo's packages, in the order they depend on one another.
 *
 * `shared` first because everything else imports it; the client before the desktop app because
 * the desktop app packages the client's web build. Running in order makes the first failure the
 * cause, rather than a consequence of it three packages down the line.
 */
export const PACKAGES: Package[] = [
  { name: 'shared', path: 'packages/shared' },
  { name: 'client', path: 'apps/client' },
  { name: 'api', path: 'apps/api' },
  { name: 'admin', path: 'apps/admin' },
  { name: 'desktop', path: 'apps/desktop' },
  { name: 'site', path: 'apps/site' },
];

/** The scripts a package declares - so we can skip whoever does not have what is being asked for. */
export function scriptsOf(pkg: Package): string[] {
  const manifest = join(repoRoot, pkg.path, 'package.json');
  if (!existsSync(manifest)) return [];
  const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { scripts?: Record<string, string> };
  return Object.keys(parsed.scripts ?? {});
}

/** Runs a command at the repository root, inheriting its output. Returns the exit code. */
export function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/** Runs a package script (`bun run --cwd <package> <script>`). */
export function runInPackage(pkg: Package, script: string, args: string[] = []): number {
  return run('bun', ['run', '--cwd', pkg.path, script, ...args]);
}
