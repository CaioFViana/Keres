import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const repoRoot = path.join(fileURLToPath(import.meta.url), '..', '..', '..');

const VERSIONED_JSON_FILES = [
  'package.json',
  'apps/api/package.json',
  'apps/client/package.json',
  'apps/desktop/package.json',
  'apps/admin/package.json',
  'apps/site/package.json',
  'packages/shared/package.json',
];
const APP_JSON_FILE = 'apps/client/app.json';
const APP_RELEASE_FILE = 'packages/shared/metadata/AppRelease.ts';

export function assertSemver(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    throw new Error(`Version must use MAJOR.MINOR.PATCH, got ${JSON.stringify(version)}.`);
  }
}

function writeJson(filePath, json) {
  writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

export function setPackageVersions(version) {
  assertSemver(version);
  for (const relativePath of VERSIONED_JSON_FILES) {
    const filePath = path.join(repoRoot, relativePath);
    const json = JSON.parse(readFileSync(filePath, 'utf8'));
    json.version = version;
    writeJson(filePath, json);
    console.log(`Set version ${version} in ${relativePath}`);
  }

  const appJsonPath = path.join(repoRoot, APP_JSON_FILE);
  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
  appJson.expo.version = version;
  writeJson(appJsonPath, appJson);
  console.log(`Set version ${version} in ${APP_JSON_FILE}`);
}

export function readReleaseName() {
  const source = readFileSync(path.join(repoRoot, APP_RELEASE_FILE), 'utf8');
  const match = source.match(/name:\s*(['\"])(.*?)\1/);
  if (!match?.[2]) {
    throw new Error(`Could not read release name from ${APP_RELEASE_FILE}.`);
  }
  return match[2];
}

export function setAppRelease(version, name) {
  assertSemver(version);
  if (!name?.trim()) {
    throw new Error('Release name cannot be empty.');
  }

  const source = `/**\n * Identidade da versão distribuída do Keres.\n *\n * Atualize com \`bun run version:set <versão> <nome>\` na raiz do repositório. Este módulo é\n * consumido tanto pelo cliente quanto pela API, portanto não há uma versão separada do servidor.\n */\nexport const APP_RELEASE = {\n  name: ${JSON.stringify(name.trim())},\n  version: ${JSON.stringify(version)},\n} as const;\n`;
  writeFileSync(path.join(repoRoot, APP_RELEASE_FILE), source);
  console.log(`Set release ${version} ${name.trim()} in ${APP_RELEASE_FILE}`);
}
