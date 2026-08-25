import { assertSemver, readReleaseName, setAppRelease, setPackageVersions } from '../lib/version';

/**
 * Writes the version coming from the Git tag into every file that declares one.
 *
 *   bun scripts/ci/set-version.ts 1.2.3
 *
 * Without the tag's "v" - the workflow strips it before calling (see
 * `.github/workflows/release.yml`). That makes the tag the single source of truth, instead of
 * every file depending on somebody having remembered to bump the number by hand.
 */
const version = process.argv[2];
if (!version) {
  console.error(`Usage: bun scripts/ci/set-version.ts <version>, for example "1.2.3".`);
  process.exit(1);
}

try {
  assertSemver(version);
  setPackageVersions(version);
  // CI takes only the version from the tag. The release name stays whatever `version:set`
  // committed, and every artifact reports the tag's version.
  setAppRelease(version, readReleaseName());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
