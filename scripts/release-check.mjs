#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  APP_JSON_FILE,
  APP_RELEASE_FILE,
  assertSemver,
  repoRoot,
  VERSIONED_JSON_FILES,
} from './version/release.mjs';

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function verifyReleaseVersions() {
  const rootVersion = readJson('package.json').version;
  assertSemver(rootVersion);
  const mismatches = [];

  for (const relativePath of VERSIONED_JSON_FILES) {
    const version = readJson(relativePath).version;
    if (version !== rootVersion) mismatches.push(`${relativePath}: ${version ?? '<missing>'}`);
  }

  const expoVersion = readJson(APP_JSON_FILE).expo?.version;
  if (expoVersion !== rootVersion)
    mismatches.push(`${APP_JSON_FILE}: ${expoVersion ?? '<missing>'}`);

  const appRelease = readFileSync(path.join(repoRoot, APP_RELEASE_FILE), 'utf8');
  const appReleaseVersion = appRelease.match(/version:\s*(['"])(.*?)\1/)?.[2];
  if (appReleaseVersion !== rootVersion)
    mismatches.push(`${APP_RELEASE_FILE}: ${appReleaseVersion ?? '<missing>'}`);

  if (mismatches.length) {
    throw new Error(
      `Versões divergentes; a âncora é package.json (${rootVersion}):\n${mismatches
        .map((mismatch) => `- ${mismatch}`)
        .join('\n')}\nUse \"bun run version:set ${rootVersion} <nome da release>\" para alinhar.`,
    );
  }

  console.log(`Versões alinhadas em ${rootVersion}.`);
}

function verifyCleanWorktree() {
  const status = spawnSync('git', ['status', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (status.error) throw status.error;
  if (status.status !== 0) process.exit(status.status ?? 1);
  if (status.stdout.trim()) {
    console.error('\nO repositório não está limpo depois dos checks:');
    console.error(status.stdout.trim());
    process.exit(1);
  }
  console.log('Worktree limpo.');
}

try {
  console.log('\n[1/6] Traduções');
  run('bun', ['run', 'locales:audit']);
  console.log('\n[2/6] Typecheck');
  run('bun', ['run', 'typecheck']);
  console.log('\n[3/6] Formatação');
  run('bun', ['run', 'format']);
  console.log('\n[4/6] Versões de release');
  verifyReleaseVersions();
  console.log('\n[5/6] Worktree');
  verifyCleanWorktree();
  console.log('\n[6/6] Relatório de testes e cobertura');
  run('bun', ['run', 'test:report']);
  console.log('\nRelease check concluído sem pendências.');
} catch (error) {
  console.error(`\nRelease check falhou: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
