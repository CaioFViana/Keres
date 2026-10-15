import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Runs the repository's formatter over the generated indexes, so what the generator writes is byte for byte what
 * `bun run format` would leave: the files are committed formatted, and a generator that wrote them raw made every
 * `prestart`/`prebuild` show up as a diff.
 *
 * Best effort: a build machine without the dev dependencies (the API image builds the hosted client) has no formatter,
 * and the index it just wrote is still valid code.
 */
export function formatGenerated(clientRoot: string, files: string[]): void {
  const bin = resolve(
    clientRoot,
    '..',
    '..',
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'biome.exe' : 'biome',
  );
  if (!existsSync(bin)) {
    console.warn('Formatter not found; the generated indexes were left as written.');
    return;
  }
  const result = spawnSync(
    bin,
    ['format', '--write', ...files.map((file) => join(clientRoot, file))],
    {
      stdio: 'inherit',
    },
  );
  if (result.status !== 0) {
    console.warn('Formatting the generated indexes failed; they were left as written.');
  }
}
