import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, run } from './lib/packages';
import {
  APP_JSON_FILE,
  APP_RELEASE_FILE,
  assertSemver,
  readJson,
  readReleaseVersion,
  VERSIONED_JSON_FILES,
} from './lib/version';

/**
 * Everything that has to be in order before cutting a release.
 *
 *   bun run release:check        on your machine, before creating the tag
 *   bun run release:check --ci   in the release workflow, before any artifact is built
 *
 * The two modes differ in what makes sense where: on a machine formatting is applied and the
 * repository has to end up clean; in CI formatting is only checked (an automatic fix there
 * never becomes a commit) and the worktree is dirty on purpose, from the version the workflow
 * itself writes out of the tag. The suites differ too: locally the full report runs, with
 * integration and coverage; in CI only the unit suites run, because the integration ones have
 * their own job, with Postgres and SeaweedFS up.
 */
const ci = process.argv.includes('--ci');

interface Step {
  title: string;
  execute: () => void;
}

function verifyReleaseVersions(): void {
  const rootVersion = readJson<{ version: string }>('package.json').version;
  assertSemver(rootVersion);
  const mismatches: string[] = [];

  for (const relativePath of VERSIONED_JSON_FILES) {
    const version = readJson<{ version?: string }>(relativePath).version;
    if (version !== rootVersion) mismatches.push(`${relativePath}: ${version ?? '<missing>'}`);
  }

  const expoVersion = readJson<{ expo?: { version?: string } }>(APP_JSON_FILE).expo?.version;
  if (expoVersion !== rootVersion)
    mismatches.push(`${APP_JSON_FILE}: ${expoVersion ?? '<missing>'}`);

  const releaseVersion = readReleaseVersion();
  if (releaseVersion !== rootVersion)
    mismatches.push(`${APP_RELEASE_FILE}: ${releaseVersion ?? '<missing>'}`);

  if (mismatches.length) {
    throw new Error(
      `Versions out of sync; package.json is the anchor (${rootVersion}):\n${mismatches
        .map((mismatch) => `- ${mismatch}`)
        .join('\n')}\nRun "bun run version:set ${rootVersion} <release name>" to align them.`,
    );
  }

  console.log(`Versions aligned at ${rootVersion}.`);
}

function verifyCleanWorktree(): void {
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
  if (status.error) throw status.error;
  if (status.stdout.trim()) {
    throw new Error(`The repository is not clean after the checks:\n${status.stdout.trim()}`);
  }
  console.log('Clean worktree.');
}

function runScript(script: string, args: string[] = []): void {
  const code = run('bun', ['run', script, ...args]);
  if (code !== 0) throw new Error(`"${script}" failed (exit code ${code}).`);
}

/** Checks that the release file exists and is readable before anything expensive runs. */
function verifyReleaseFileReadable(): void {
  readFileSync(join(repoRoot, APP_RELEASE_FILE), 'utf8');
}

const steps: Step[] = [
  { title: 'Translations', execute: () => runScript('locales:audit') },
  { title: 'Typecheck', execute: () => runScript('typecheck') },
  { title: 'Lint', execute: () => runScript('lint') },
  {
    title: ci ? 'Formatting (check only)' : 'Formatting',
    execute: () => runScript(ci ? 'format:check' : 'format'),
  },
  {
    title: 'Release versions',
    execute: () => {
      verifyReleaseFileReadable();
      verifyReleaseVersions();
    },
  },
  ...(ci ? [] : [{ title: 'Worktree', execute: verifyCleanWorktree }]),
  {
    title: ci ? 'Unit tests and coverage' : 'Test and coverage report',
    execute: () => runScript(ci ? 'test:coverage' : 'test:report'),
  },
];

try {
  steps.forEach((step, index) => {
    console.log(`\n[${index + 1}/${steps.length}] ${step.title}`);
    step.execute();
  });
  console.log('\nRelease check finished with nothing pending.');
} catch (error) {
  console.error(`\nRelease check failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
