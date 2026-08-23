#!/usr/bin/env node
// Writes a single version (derived from the git tag that triggered the release workflow) into
// every package.json/app.json that ships a version number, so a tag like v1.2.3 is the one
// source of truth instead of each file needing a manual bump kept in sync by hand.
//
// Usage: node scripts/ci/set-version.mjs 1.2.3
// (no leading "v" - strip that before calling, see .github/workflows/release.yml)

import {
  assertSemver,
  readReleaseName,
  setAppRelease,
  setPackageVersions,
} from '../version/release.mjs';

const version = process.argv[2];
if (!version) {
  console.error(
    `Usage: node set-version.mjs <version>, e.g. "1.2.3" (got: ${JSON.stringify(version)})`,
  );
  process.exit(1);
}

try {
  assertSemver(version);
  setPackageVersions(version);
  // CI derives only the semantic version from its Git tag. Preserve the release name committed
  // by `version:set`, while making every build artifact report the tag's version.
  setAppRelease(version, readReleaseName());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
