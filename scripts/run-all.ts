import { PACKAGES, run, runInPackage, scriptsOf } from './lib/packages';

/**
 * Runs the same script in every package that declares it.
 *
 *   bun scripts/run-all.ts typecheck
 *
 * It exists so the root does not carry six chains of `bun run --cwd ... && bun run --cwd ...`
 * that nobody can read or keep in order. A package that does not declare the script is skipped
 * - only the `api` has integration tests, only the client has `db:generate` - and the first
 * failure stops everything: in a chain ordered by dependency, the second error is usually a
 * consequence of the first.
 */
const script = process.argv[2];
if (!script) {
  console.error('Usage: bun scripts/run-all.ts <script>, for example "typecheck".');
  process.exit(1);
}

const targets = PACKAGES.filter((pkg) => scriptsOf(pkg).includes(script));
if (targets.length === 0) {
  console.error(`No package declares the script "${script}".`);
  process.exit(1);
}

for (const pkg of targets) {
  console.log(`\n=== ${pkg.name}: ${script}`);
  const code = runInPackage(pkg, script);
  if (code !== 0) {
    console.error(`\n${pkg.name}: "${script}" failed (exit code ${code}).`);
    process.exit(code);
  }
}

// The repository's own scripts are not a package, but they are TypeScript: they go through the
// type check along with everything else, or they would be the only part of the repository with
// no safety net at all.
if (script === 'typecheck') {
  console.log('\n=== repository scripts: typecheck');
  const code = run('bunx', ['tsc', '--noEmit', '-p', 'scripts/tsconfig.json']);
  if (code !== 0) process.exit(code);
}
