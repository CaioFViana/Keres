import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANDROID_BUILD_GRADLE, patchGradleVersion } from '../lib/android';
import { repoRoot } from '../lib/packages';
import { assertTagVersion } from '../lib/version';

/**
 * Stamps the tag's version onto the freshly prebuilt Android project.
 * Release and dev-build workflows (`mobile-android` job, after `expo prebuild`).
 *
 *   bun scripts/ci/set-android-version.ts 1.2.3
 *   bun scripts/ci/set-android-version.ts 1.2.3-dev1 --allow-prerelease   (dev-build workflow)
 *
 * Without the tag's "v" - the workflow strips it before calling, like
 * `set-version.ts`. Rejects pre-release suffixes unless `--allow-prerelease` is passed
 * (the dev-build workflow): `1.2.3-dev1` would stamp the same versionCode as `1.2.3`
 * and collide on upload, which only matters for what goes to a store - a dev build never does.
 */
const allowPrerelease = process.argv.includes('--allow-prerelease');
const version = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
if (!version) {
  console.error(
    'Usage: bun scripts/ci/set-android-version.ts <version> [--allow-prerelease], for example "1.2.3".',
  );
  process.exit(1);
}

try {
  assertTagVersion(version);
  const filePath = join(repoRoot, ANDROID_BUILD_GRADLE);
  let source: string;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(
      `Could not read ${ANDROID_BUILD_GRADLE}; run expo prebuild before this script.`,
    );
  }
  writeFileSync(filePath, patchGradleVersion(source, version, { allowPrerelease }));
  console.log(`Set Android ${version} in ${ANDROID_BUILD_GRADLE}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
