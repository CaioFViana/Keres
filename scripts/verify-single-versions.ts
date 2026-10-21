import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './lib/packages';

/**
 * Fails when a workspace has its own copy of a package that the workspaces exchange types through.
 *
 * `packages/shared` hands its schemas to the client and to the API, and the API's route types are built on top of
 * `zod`, `drizzle-orm` and `elysia`: if the API and `@keres/shared` each resolve their own version, the compiler holds
 * two copies of every type those libraries make and instantiates each against the other. The API's typecheck then ran
 * out of its 4 GB heap (26 s and well under a gigabyte with one copy), in CI first, because a plain `bun install` had
 * re-resolved two workspaces to a newer `zod` and the lockfile recorded it. A transitive dependency of a tool
 * (`knip/zod`, `@expo/cli/zod`) may carry its own version; a workspace of ours may not.
 *
 * Reading `bun.lock`: a workspace's own copy is a key of the form `<workspace name>/<package>`.
 */
const SHARED_TYPES = ['zod', 'drizzle-orm', 'elysia', 'typescript', 'react'];

function workspaceNames(): string[] {
  const names: string[] = [];
  for (const group of ['apps', 'packages']) {
    const base = join(repoRoot, group);
    if (!existsSync(base)) continue;
    for (const folder of readdirSync(base)) {
      const manifest = join(base, folder, 'package.json');
      if (existsSync(manifest))
        names.push(JSON.parse(readFileSync(manifest, 'utf8')).name as string);
    }
  }
  return names;
}

const lock = readFileSync(join(repoRoot, 'bun.lock'), 'utf8');
const problems: string[] = [];
for (const workspace of workspaceNames()) {
  for (const pkg of SHARED_TYPES) {
    const key = `"${workspace}/${pkg}"`;
    const line = lock.split('\n').find((candidate) => candidate.trimStart().startsWith(`${key}:`));
    if (line) {
      const version = /\["[^@"]*@?[^@"]*@([^"]+)"/.exec(line)?.[1] ?? '?';
      problems.push(
        `${workspace} has its own ${pkg}@${version}, apart from the one the others share`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('Workspaces with a private copy of a package they exchange types through:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    '\nPut the same version in every workspace that declares it (or remove the lockfile entry and run `bun install`).',
  );
  process.exit(1);
}
console.log(`One copy of ${SHARED_TYPES.join(', ')} across the workspaces.`);
