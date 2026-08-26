import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the API finds migrations, the admin panel, the client's export and the icon - in dev, in
 * the portable zip and in a `bun build --compile`.
 *
 * It does not use `process.cwd()`: Docker, shortcuts and the compiled binary start from folders that
 * are not `apps/api`. Candidates, in order:
 *   1. `KERES_RESOURCE_ROOT` (packager / tests);
 *   2. the executable's folder (the zip's layout: `drizzle/`, `admin-dist/`, …);
 *   3. the monorepo tree from this file (`src/config` → `apps/api` / `apps/admin`).
 */

const thisDirectory = path.dirname(fileURLToPath(import.meta.url));

export function firstExistingPath(candidates: readonly string[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function resourceOverride(): string | undefined {
  const configured = process.env.KERES_RESOURCE_ROOT;
  return configured && configured.length > 0 ? path.resolve(configured) : undefined;
}

function executableDirectory(): string {
  return path.dirname(process.execPath);
}

/** `apps/api` in the checkout; the binary's folder in the package. */
export function apiPackageRoot(): string {
  const override = resourceOverride();
  const found = firstExistingPath(
    [override, executableDirectory(), path.join(thisDirectory, '..', '..')].filter(
      (value): value is string => Boolean(value),
    ),
  );
  return found ?? path.join(thisDirectory, '..', '..');
}

export function migrationsFolder(usingSqlite: boolean): string {
  const name = usingSqlite ? 'drizzle-sqlite' : 'drizzle';
  const override = resourceOverride();
  const found = firstExistingPath(
    [
      override ? path.join(override, name) : undefined,
      path.join(executableDirectory(), name),
      path.join(thisDirectory, '..', '..', name),
    ].filter((value): value is string => Boolean(value)),
  );
  if (!found) {
    throw new Error(`Cannot find database migrations folder "${name}".`);
  }
  return found;
}

export function adminDistPath(): string {
  const override = resourceOverride();
  return (
    firstExistingPath(
      [
        override ? path.join(override, 'admin-dist') : undefined,
        override ? path.join(override, 'admin', 'dist') : undefined,
        path.join(executableDirectory(), 'admin-dist'),
        path.join(executableDirectory(), 'admin', 'dist'),
        path.join(thisDirectory, '..', '..', '..', 'admin', 'dist'),
      ].filter((value): value is string => Boolean(value)),
    ) ?? path.join(thisDirectory, '..', '..', '..', 'admin', 'dist')
  );
}

export function showcaseDistPath(): string {
  const override = resourceOverride();
  return (
    firstExistingPath(
      [
        override ? path.join(override, 'dist-showcase') : undefined,
        override ? path.join(override, 'admin', 'dist-showcase') : undefined,
        path.join(executableDirectory(), 'dist-showcase'),
        path.join(executableDirectory(), 'admin', 'dist-showcase'),
        path.join(thisDirectory, '..', '..', '..', 'admin', 'dist-showcase'),
      ].filter((value): value is string => Boolean(value)),
    ) ?? path.join(thisDirectory, '..', '..', '..', 'admin', 'dist-showcase')
  );
}

/**
 * Export web do cliente (`expo export -p web`). O Electron consome o mesmo `dist`
 * pelo protocolo `app://`; a API serve-o na raiz do origin.
 */
export function clientDistPath(): string {
  const override = resourceOverride();
  return (
    firstExistingPath(
      [
        override ? path.join(override, 'client-dist') : undefined,
        override ? path.join(override, 'client', 'dist') : undefined,
        path.join(executableDirectory(), 'client-dist'),
        path.join(executableDirectory(), 'client', 'dist'),
        path.join(thisDirectory, '..', '..', '..', 'client', 'dist'),
      ].filter((value): value is string => Boolean(value)),
    ) ?? path.join(thisDirectory, '..', '..', '..', 'client', 'dist')
  );
}

export function desktopIconPath(): string {
  const override = resourceOverride();
  return (
    firstExistingPath(
      [
        override ? path.join(override, 'desktop_icon.png') : undefined,
        path.join(executableDirectory(), 'desktop_icon.png'),
        path.join(
          thisDirectory,
          '..',
          '..',
          '..',
          'client',
          'assets',
          'images',
          'desktop_icon.png',
        ),
      ].filter((value): value is string => Boolean(value)),
    ) ??
    path.join(thisDirectory, '..', '..', '..', 'client', 'assets', 'images', 'desktop_icon.png')
  );
}
