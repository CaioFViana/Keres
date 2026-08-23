#!/usr/bin/env node
import { assertSemver, setAppRelease, setPackageVersions } from './release.mjs';

const [version, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();

try {
  assertSemver(version);
  if (!name) {
    throw new Error('Release name cannot be empty.');
  }
  setPackageVersions(version);
  setAppRelease(version, name);
} catch (error) {
  console.error(
    `Usage: bun run version:set <version> <release name>, e.g. "bun run version:set 1.4.2 Galatea"\n${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}
