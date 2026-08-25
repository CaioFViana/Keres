import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import electronModule from 'electron';

/**
 * Sobe o app web dentro do Electron uma vez e confere que o SQLite do navegador abre.
 *
 * É o único caminho que exerce wa-sqlite + OPFS + SharedArrayBuffer de ponta a ponta, e depende
 * dos cabeçalhos COOP/COEP que o protocolo `app://` do processo principal entrega - nenhum
 * teste unitário cobre essa combinação.
 */
const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = resolve(desktopRoot, '..', 'client');
// Importado de fora do Electron, o pacote `electron` exporta o caminho do binário - a tipagem
// publicada descreve a API do processo principal, que é o outro lado do mesmo pacote.
const electronBinary = electronModule as unknown as string;
const smokeEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  EXPO_PUBLIC_SQLITE_WEB_SMOKE_TEST: 'true',
};
delete smokeEnvironment.ELECTRON_RUN_AS_NODE;

function run(command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }) {
  return new Promise<void>((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else
        reject(new Error(`${command} ${args.join(' ')} ended with ${signal || `code ${code}`}.`));
    });
  });
}

async function main() {
  await run('bun', ['run', 'build'], { cwd: clientRoot, env: smokeEnvironment });
  await run('bun', ['run', 'build:main'], { cwd: desktopRoot });
  const userDataDir = await mkdtemp(join(tmpdir(), 'keres-sqlite-web-smoke-'));
  try {
    await run(electronBinary, ['.', '--sqlite-web-smoke-test', `--user-data-dir=${userDataDir}`], {
      cwd: desktopRoot,
      env: smokeEnvironment,
    });
  } finally {
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error('[sqlite-web-smoke]', error);
  process.exitCode = 1;
});
