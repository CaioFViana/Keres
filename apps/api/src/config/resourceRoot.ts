import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the API finds migrations, the web bundles and the icon - in dev, in the portable zip and in
 * a `bun build --compile`.
 *
 * It does not use `process.cwd()`: Docker, shortcuts and the compiled binary start from folders that
 * are not `apps/api`. Candidates, in order:
 *   1. `KERES_RESOURCE_ROOT` (packager / tests);
 *   2. the executable's folder (the zip's layout: `drizzle/`, `dist-admin/`, …);
 *   3. the monorepo tree from this file (`src/config` → `apps/api` / `apps/web`).
 */

const thisDirectory = path.dirname(fileURLToPath(import.meta.url));

/** `apps/` in the checkout: the sibling apps whose build outputs the API serves. */
const appsDirectory = path.join(thisDirectory, '..', '..', '..');

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

/**
 * The four web bundles the API serves, once: `packaged` is the folder's name in the zip, the image and
 * the desktop app (every build folder is `dist-<name>`); `checkout` is where the same build lands in the
 * monorepo, relative to `apps/`; `buildScript` is the root script that produces it.
 *
 * Each is an export made for its own prefix (its base path is part of every URL in it), so none can
 * stand in for a `dist` made for another place: the client's is not the one Electron loads over `app://`,
 * the landing page's is not the one GitHub Pages publishes.
 */
export const WEB_BUNDLES = {
  admin: { packaged: 'dist-admin', checkout: ['web', 'dist'], buildScript: 'web:build' },
  showcase: {
    packaged: 'dist-showcase',
    checkout: ['web', 'dist-showcase'],
    buildScript: 'web:build',
  },
  landing: {
    packaged: 'dist-landing',
    checkout: ['site', 'dist-landing'],
    buildScript: 'site:build:landing',
  },
  client: {
    packaged: 'dist-client',
    checkout: ['client', 'dist-hosted'],
    buildScript: 'client:build:hosted',
  },
} as const;

export type WebBundleName = keyof typeof WEB_BUNDLES;

/** The bundle's folder: under the override, beside the executable or in the checkout - the checkout's when none exists yet. */
export function webBundlePath(name: WebBundleName): string {
  const { packaged, checkout } = WEB_BUNDLES[name];
  const override = resourceOverride();
  const inCheckout = path.join(appsDirectory, ...checkout);
  return (
    firstExistingPath(
      [
        override ? path.join(override, packaged) : undefined,
        override ? path.join(override, ...checkout) : undefined,
        path.join(executableDirectory(), packaged),
        path.join(executableDirectory(), ...checkout),
        inCheckout,
      ].filter((value): value is string => Boolean(value)),
    ) ?? inCheckout
  );
}

export const adminDistPath = () => webBundlePath('admin');
export const showcaseDistPath = () => webBundlePath('showcase');
export const landingDistPath = () => webBundlePath('landing');
export const clientDistPath = () => webBundlePath('client');

export function desktopIconPath(): string {
  const override = resourceOverride();
  const inCheckout = path.join(appsDirectory, 'client', 'assets', 'images', 'desktop_icon.png');
  return (
    firstExistingPath(
      [
        override ? path.join(override, 'desktop_icon.png') : undefined,
        path.join(executableDirectory(), 'desktop_icon.png'),
        inCheckout,
      ].filter((value): value is string => Boolean(value)),
    ) ?? inCheckout
  );
}
