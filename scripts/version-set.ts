import { assertSemver, setAppRelease, setPackageVersions } from './lib/version';

/**
 * Aligns the released version across every file that declares one.
 *
 *   bun run version:set 1.4.2 Galatea
 */
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
    `Usage: bun run version:set <version> <release name>, for example "bun run version:set 1.4.2 Galatea"\n${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}
