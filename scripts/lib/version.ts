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
 * `setAppRelease` only touches the `name` and `version` fields of `AppRelease.ts` - the release
 * phrase and the credits next to them are hand-owned and survive releases. These numbers are
 * bumped by a person who knows whether the format or the wire actually changed; `release-check`
 * reads them out so the question gets asked.
 */
export const RELEASE_VERSIONS_FILE = 'packages/shared/metadata/ReleaseVersions.ts';

export function assertSemver(version: string | undefined): asserts version is string {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    throw new Error(`Version must use MAJOR.MINOR.PATCH, got ${JSON.stringify(version)}.`);
  }
}

/**
 * What a version tag may carry: a release (`1.2.3`) or a development build (`1.2.3-dev1`).
 * Only CI tag-stamping accepts the suffix - the files committed to the repository stay plain
 * MAJOR.MINOR.PATCH, enforced by `assertSemver` in `version:set` and `release-check`.
 */
export function assertTagVersion(version: string | undefined): asserts version is string {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version ?? '')) {
    throw new Error(
      `Version must use MAJOR.MINOR.PATCH with an optional -prerelease suffix, got ${JSON.stringify(version)}.`,
    );
  }
}

function writeJson(filePath: string, json: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

export function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as T;
}

export function setPackageVersions(version: string): void {
  assertTagVersion(version);
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

const APP_RELEASE_BLOCK_PATTERN = /(export const APP_RELEASE = \{)([\s\S]*?)(\} as const;)/;

/**
 * The body of the `APP_RELEASE` literal. Reads and writes stay inside it: the credits below the
 * identity carry their own `name` fields, and an unanchored `name:` match would be one reorder
 * away from stamping the version onto an icon author.
 */
function readAppReleaseBody(): string {
  const source = readFileSync(join(repoRoot, APP_RELEASE_FILE), 'utf8');
  const block = APP_RELEASE_BLOCK_PATTERN.exec(source);
  if (!block) {
    throw new Error(`Could not find APP_RELEASE in ${APP_RELEASE_FILE}.`);
  }
  return block[2];
}

export function readReleaseName(): string {
  const match = readAppReleaseBody().match(/^\s*name:\s*(['"])(.*?)\1/m);
  if (!match?.[2]) {
    throw new Error(`Could not read release name from ${APP_RELEASE_FILE}.`);
  }
  return match[2];
}

export function readReleaseVersion(): string | undefined {
  return readAppReleaseBody().match(/^\s*version:\s*(['"])(.*?)\1/m)?.[2];
}

export function readReleasePhrase(): string | undefined {
  return readAppReleaseBody().match(/^\s*phrase:\s*(['"])([\s\S]*?)\1/m)?.[2];
}

/**
 * Replaces one quoted field inside the `APP_RELEASE` literal, keeping the file's own quote
 * style: the release phrase and the credits around it are hand-owned and must survive a
 * release untouched and still formatted (biome quotes single).
 */
function setReleaseField(body: string, field: 'name' | 'version', value: string): string {
  const pattern = new RegExp(`(^\\s*${field}:\\s*)(['"])(.*?)\\2`, 'm');
  const match = pattern.exec(body);
  if (!match) {
    throw new Error(`Could not find ${field} in ${APP_RELEASE_FILE}.`);
  }
  const quote = match[2];
  const escaped = value.replace(/\\/g, '\\\\').replaceAll(quote, `\\${quote}`);
  return (
    body.slice(0, match.index) +
    match[1] +
    quote +
    escaped +
    quote +
    body.slice(match.index + match[0].length)
  );
}

export function setAppRelease(version: string, name: string): void {
  assertTagVersion(version);
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new Error('Release name cannot be empty.');
  }

  const filePath = join(repoRoot, APP_RELEASE_FILE);
  const source = readFileSync(filePath, 'utf8');
  const block = APP_RELEASE_BLOCK_PATTERN.exec(source);
  if (!block) {
    throw new Error(`Could not find APP_RELEASE in ${APP_RELEASE_FILE}.`);
  }
  const updated = setReleaseField(setReleaseField(block[2], 'name', trimmed), 'version', version);
  const rewritten =
    source.slice(0, block.index) +
    block[1] +
    updated +
    block[3] +
    source.slice(block.index + block[0].length);
  writeFileSync(filePath, rewritten);
  console.log(`Set release ${version} ${trimmed} in ${APP_RELEASE_FILE}`);
}
