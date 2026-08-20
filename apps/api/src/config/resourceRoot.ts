import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Onde a API acha migrações, painel admin e ícone — em dev, no zip portátil e num
 * `bun build --compile`.
 *
 * Não usa `process.cwd()`: Docker, atalhos e o binário compilado arrancam de pastas
 * que não são `apps/api`. Candidatos, por ordem:
 *   1. `KERES_RESOURCE_ROOT` (empacotador / testes);
 *   2. pasta do executável (layout do zip: `drizzle/`, `admin-dist/`, …);
 *   3. árvore do monorepo a partir deste ficheiro (`src/config` → `apps/api` / `apps/admin`).
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

/** `apps/api` no checkout; a pasta do binário no pacote. */
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
