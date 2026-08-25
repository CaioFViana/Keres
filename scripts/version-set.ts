import { assertSemver, setAppRelease, setPackageVersions } from './lib/version';

/**
 * Alinha a versão distribuída em todos os arquivos que a declaram.
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
    `Uso: bun run version:set <versão> <nome da release>, por exemplo "bun run version:set 1.4.2 Galatea"\n${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}
