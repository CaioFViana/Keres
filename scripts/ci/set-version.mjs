#!/usr/bin/env node
// Writes a single version (derived from the git tag that triggered the release workflow) into
// every package.json/app.json that ships a version number, so a tag like v1.2.3 is the one
// source of truth instead of each file needing a manual bump kept in sync by hand.
//
// Usage: node scripts/ci/set-version.mjs 1.2.3
// (no leading "v" - strip that before calling, see .github/workflows/release.yml)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Usage: node set-version.mjs <version>, e.g. "1.2.3" (got: ${JSON.stringify(version)})`);
  process.exit(1);
}

const repoRoot = path.join(fileURLToPath(import.meta.url), '..', '..', '..');

function setJsonVersion(relativePath, getVersionObj) {
  const filePath = path.join(repoRoot, relativePath);
  const json = JSON.parse(readFileSync(filePath, 'utf8'));
  const target = getVersionObj(json);
  target.version = version;
  // Trailing newline to match how these files are normally saved (avoids a diff-only-in-EOF).
  writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
  console.log(`Set version ${version} in ${relativePath}`);
}

setJsonVersion('package.json', (json) => json);
setJsonVersion('apps/api/package.json', (json) => json);
setJsonVersion('apps/client/package.json', (json) => json);
setJsonVersion('apps/desktop/package.json', (json) => json);
setJsonVersion('apps/admin/package.json', (json) => json);
setJsonVersion('packages/shared/package.json', (json) => json);
// Expo's app.json nests its config under an "expo" key - version lives there, not at the root.
setJsonVersion('apps/client/app.json', (json) => json.expo);
