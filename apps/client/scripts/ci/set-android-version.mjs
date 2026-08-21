#!/usr/bin/env node
// Writes versionName/versionCode into the Expo-prebuild-generated android/app/build.gradle.
// Must run from apps/client, AFTER `expo prebuild --platform android`.
//
// Usage: node scripts/ci/set-android-version.mjs 1.2.3
//
// versionCode is derived from the semver itself (major*10000 + minor*100 + patch) rather than
// tracked separately - Play Store requires it strictly increasing per upload, and deriving it
// from the version tag guarantees that for any normal (non-decreasing) sequence of releases
// without needing extra state committed anywhere.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const version = process.argv[2];
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
if (!match) {
  console.error(
    `Usage: node set-android-version.mjs <version>, e.g. "1.2.3" (got: ${JSON.stringify(version)})`,
  );
  process.exit(1);
}
const versionCode = Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);

const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
let contents = readFileSync(gradlePath, 'utf8');

const before = contents;
contents = contents.replace(/versionCode \d+/, `versionCode ${versionCode}`);
contents = contents.replace(/versionName "[^"]*"/, `versionName "${version}"`);

if (contents === before) {
  console.error(
    'set-android-version: no versionCode/versionName replacement was made - the Expo prebuild template must have changed shape. Update this script.',
  );
  process.exit(1);
}

writeFileSync(gradlePath, contents);
console.log(`Set android/app/build.gradle: versionName "${version}", versionCode ${versionCode}.`);
