// Writes versionName/versionCode into the Expo-prebuild-generated android/app/build.gradle.
// Must run from apps/client, AFTER `expo prebuild --platform android`.
//
// Usage: bun scripts/ci/set-android-version.ts 1.2.3
//
// versionCode is derived from the semver itself (major*10000 + minor*100 + patch) rather than
// tracked separately - Play Store requires it strictly increasing per upload, and deriving it
// from the version tag guarantees that for any normal (non-decreasing) sequence of releases
// without needing extra state committed anywhere.
//
// A development tag (`1.2.3-dev1`) keeps its suffix in versionName but shares the core's
// versionCode - dev artifacts are sideloaded from the run's Artifacts tab, never uploaded to a
// store track, so code collisions between dev builds of the same core do not matter.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function parseAndroidVersion(version: string | undefined): {
  versionName: string;
  versionCode: number;
} {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(version ?? '');
  if (!match) {
    throw new Error(
      `Version must use MAJOR.MINOR.PATCH with an optional -prerelease suffix, got ${JSON.stringify(version)}.`,
    );
  }
  return {
    versionName: version as string,
    versionCode: Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]),
  };
}

const version = process.argv[2];
let parsed: { versionName: string; versionCode: number };
try {
  parsed = parseAndroidVersion(version);
} catch {
  console.error(
    `Usage: bun scripts/ci/set-android-version.ts <version>, e.g. "1.2.3" (got: ${JSON.stringify(version)})`,
  );
  process.exit(1);
}
const { versionName, versionCode } = parsed;

const gradlePath = join(process.cwd(), 'android', 'app', 'build.gradle');
let contents = readFileSync(gradlePath, 'utf8');

const before = contents;
contents = contents.replace(/versionCode \d+/, `versionCode ${versionCode}`);
contents = contents.replace(/versionName "[^"]*"/, `versionName "${versionName}"`);

if (contents === before) {
  console.error(
    'set-android-version: no versionCode/versionName replacement was made - the Expo prebuild template must have changed shape. Update this script.',
  );
  process.exit(1);
}

writeFileSync(gradlePath, contents);
console.log(
  `Set android/app/build.gradle: versionName "${versionName}", versionCode ${versionCode}.`,
);
