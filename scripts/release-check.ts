import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, run } from './lib/packages';
import {
  APP_JSON_FILE,
  APP_RELEASE_FILE,
  assertSemver,
  readJson,
  readReleaseVersion,
  VERSIONED_JSON_FILES,
} from './lib/version';

/**
 * Tudo o que precisa estar em ordem antes de cortar uma release.
 *
 *   bun run release:check        na máquina, antes de criar a tag
 *   bun run release:check --ci   no workflow de release, antes de compilar qualquer artefato
 *
 * A diferença entre os dois modos é o que faz sentido em cada lugar: na máquina a formatação é
 * aplicada e o repositório tem que terminar limpo; na CI a formatação é só conferida (uma
 * correção automática ali não vira commit nenhum) e o worktree já está sujo de propósito, pela
 * versão que o próprio workflow escreve a partir da tag. As suítes também mudam: localmente
 * roda o relatório completo, com integração e cobertura; na CI rodam as unitárias, porque as
 * de integração têm um job próprio, com Postgres e SeaweedFS de pé.
 */
const ci = process.argv.includes('--ci');

interface Step {
  title: string;
  execute: () => void;
}

function verifyReleaseVersions(): void {
  const rootVersion = readJson<{ version: string }>('package.json').version;
  assertSemver(rootVersion);
  const mismatches: string[] = [];

  for (const relativePath of VERSIONED_JSON_FILES) {
    const version = readJson<{ version?: string }>(relativePath).version;
    if (version !== rootVersion) mismatches.push(`${relativePath}: ${version ?? '<ausente>'}`);
  }

  const expoVersion = readJson<{ expo?: { version?: string } }>(APP_JSON_FILE).expo?.version;
  if (expoVersion !== rootVersion)
    mismatches.push(`${APP_JSON_FILE}: ${expoVersion ?? '<ausente>'}`);

  const releaseVersion = readReleaseVersion();
  if (releaseVersion !== rootVersion)
    mismatches.push(`${APP_RELEASE_FILE}: ${releaseVersion ?? '<ausente>'}`);

  if (mismatches.length) {
    throw new Error(
      `Versões divergentes; a âncora é package.json (${rootVersion}):\n${mismatches
        .map((mismatch) => `- ${mismatch}`)
        .join('\n')}\nUse "bun run version:set ${rootVersion} <nome da release>" para alinhar.`,
    );
  }

  console.log(`Versões alinhadas em ${rootVersion}.`);
}

function verifyCleanWorktree(): void {
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
  if (status.error) throw status.error;
  if (status.stdout.trim()) {
    throw new Error(`O repositório não está limpo depois dos checks:\n${status.stdout.trim()}`);
  }
  console.log('Worktree limpo.');
}

function runScript(script: string, args: string[] = []): void {
  const code = run('bun', ['run', script, ...args]);
  if (code !== 0) throw new Error(`"${script}" falhou (código ${code}).`);
}

/** Confere que o arquivo de release existe e é legível antes de qualquer coisa cara. */
function verifyReleaseFileReadable(): void {
  readFileSync(join(repoRoot, APP_RELEASE_FILE), 'utf8');
}

const steps: Step[] = [
  { title: 'Traduções', execute: () => runScript('locales:audit') },
  { title: 'Typecheck', execute: () => runScript('typecheck') },
  { title: 'Lint', execute: () => runScript('lint') },
  {
    title: ci ? 'Formatação (conferência)' : 'Formatação',
    execute: () => runScript(ci ? 'format:check' : 'format'),
  },
  {
    title: 'Versões de release',
    execute: () => {
      verifyReleaseFileReadable();
      verifyReleaseVersions();
    },
  },
  ...(ci ? [] : [{ title: 'Worktree', execute: verifyCleanWorktree }]),
  {
    title: ci ? 'Testes unitários e cobertura' : 'Relatório de testes e cobertura',
    execute: () => runScript(ci ? 'test:coverage' : 'test:report'),
  },
];

try {
  steps.forEach((step, index) => {
    console.log(`\n[${index + 1}/${steps.length}] ${step.title}`);
    step.execute();
  });
  console.log('\nRelease check concluído sem pendências.');
} catch (error) {
  console.error(`\nRelease check falhou: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
