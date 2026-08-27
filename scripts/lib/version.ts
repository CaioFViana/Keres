import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './packages';

/**
 * The released version of Keres lives in several files, and all of them have to say the same
 * thing: every package's `package.json`, Expo's `app.json`, and the `AppRelease.ts` that client
 * and API display. This module is the only place that writes to those files.
 */
export const VERSIONED_JSON_FILES = [
  'package.json',
  'apps/api/package.json',
  'apps/client/package.json',
  'apps/desktop/package.json',
  'apps/admin/package.json',
  'apps/site/package.json',
  'packages/shared/package.json',
];
export const APP_JSON_FILE = 'apps/client/app.json';
export const APP_RELEASE_FILE = 'packages/shared/metadata/AppRelease.ts';
/**
 * The compatibility numbers, which this module deliberately does **not** write.
 *
 * `setAppRelease` rewrites `AppRelease.ts` whole from a template, so anything kept there would be
 * erased at the next release. These are bumped by a person who knows whether the format or the wire
 * actually changed; `release-check` reads them out so the question gets asked.
 */
export const RELEASE_VERSIONS_FILE = 'packages/shared/metadata/ReleaseVersions.ts';

export function assertSemver(version: string | undefined): asserts version is string {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    throw new Error(`Version must use MAJOR.MINOR.PATCH, got ${JSON.stringify(version)}.`);
  }
}

function writeJson(filePath: string, json: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

export function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as T;
}

export function setPackageVersions(version: string): void {
  assertSemver(version);
  for (const relativePath of VERSIONED_JSON_FILES) {
    const filePath = join(repoRoot, relativePath);
    const json = JSON.parse(readFileSync(filePath, 'utf8')) as { version?: string };
    json.version = version;
    writeJson(filePath, json);
    console.log(`Set version ${version} in ${relativePath}`);
  }

  const appJsonPath = join(repoRoot, APP_JSON_FILE);
  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8')) as { expo: { version: string } };
  appJson.expo.version = version;
  writeJson(appJsonPath, appJson);
  console.log(`Set version ${version} in ${APP_JSON_FILE}`);
}

export function readReleaseName(): string {
  const source = readFileSync(join(repoRoot, APP_RELEASE_FILE), 'utf8');
  const match = source.match(/name:\s*(['"])(.*?)\1/);
  if (!match?.[2]) {
    throw new Error(`Could not read release name from ${APP_RELEASE_FILE}.`);
  }
  return match[2];
}

export function readReleaseVersion(): string | undefined {
  const source = readFileSync(join(repoRoot, APP_RELEASE_FILE), 'utf8');
  return source.match(/version:\s*(['"])(.*?)\1/)?.[2];
}

export function setAppRelease(version: string, name: string): void {
  assertSemver(version);
  if (!name?.trim()) {
    throw new Error('Release name cannot be empty.');
  }

  const source = `/**\n * Identity of the released version of Keres.\n *\n * Update it with \`bun run version:set <version> <name>\` at the repository root. This module is\n * consumed by both the client and the API, so there is no separate server version.\n */\nexport const APP_RELEASE = {\n  name: ${JSON.stringify(name.trim())},\n  version: ${JSON.stringify(version)},\n} as const;\n`;
  writeFileSync(join(repoRoot, APP_RELEASE_FILE), source);
  console.log(`Set release ${version} ${name.trim()} in ${APP_RELEASE_FILE}`);
}
