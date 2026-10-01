import { PACKAGES, run, runInPackage, scriptsOf } from './lib/packages';

/**
 * Runs the same script in every package that declares it.
 *
 *   bun scripts/run-all.ts typecheck
 *   bun scripts/run-all.ts test:coverage --only client
 *
 * It exists so the root does not carry six chains of `bun run --cwd ... && bun run --cwd ...`
 * that nobody can read or keep in order. A package that does not declare the script is skipped
 * - only the `api` has integration tests, only the client has `db:generate` - and the first
 * failure stops everything: in a chain ordered by dependency, the second error is usually a
 * consequence of the first.
 *
 * `--only <name>` restricts the run to a single package (CI's per-package matrix jobs use
 * this); a package without the script is a clean skip, not a failure. The repository's own
 * scripts are only checked on unfiltered `typecheck` runs - CI covers them in a dedicated job.
 */
const script = process.argv[2];
if (!script || script.startsWith('--')) {
  console.error(
    'Usage: bun scripts/run-all.ts <script> [--only <package>], for example "typecheck".',
  );
  process.exit(1);
}

const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex === -1 ? undefined : process.argv[onlyIndex + 1];
if (onlyIndex !== -1 && !only) {
  console.error('Usage: bun scripts/run-all.ts <script> --only <package>.');
  process.exit(1);
}

const candidates = only ? PACKAGES.filter((pkg) => pkg.name === only) : PACKAGES;
if (only && candidates.length === 0) {
  console.error(`Unknown package "${only}".`);
  process.exit(1);
}

const targets = candidates.filter((pkg) => scriptsOf(pkg).includes(script));
if (targets.length === 0) {
  if (only) {
    console.log(`Skipping "${script}": package "${only}" does not declare it.`);
    process.exit(0);
  }
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
if (script === 'typecheck' && !only) {
  console.log('\n=== repository scripts: typecheck');
  const code = run('bun', ['run', 'typecheck:scripts']);
  if (code !== 0) process.exit(code);
}
