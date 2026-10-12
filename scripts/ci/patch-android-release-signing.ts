import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANDROID_BUILD_GRADLE, applySigningPatch } from '../lib/android';
import { repoRoot } from '../lib/packages';

/**
 * Wires the release keystore into the freshly prebuilt Android project.
 * Release workflow only (`mobile-android` job, after `expo prebuild`).
 *
 *   bun scripts/ci/patch-android-release-signing.ts
 *
 * The keystore itself arrives as `-PRELEASE_*` Gradle properties (see
 * `.github/workflows/release.yml`); this only adds the config block that reads
 * them. Idempotent: a second run changes nothing.
 */
try {
  const filePath = join(repoRoot, ANDROID_BUILD_GRADLE);
  let source: string;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(
      `Could not read ${ANDROID_BUILD_GRADLE}; run expo prebuild before this script.`,
    );
  }
  writeFileSync(filePath, applySigningPatch(source));
  console.log(`Wired release signing in ${ANDROID_BUILD_GRADLE}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
