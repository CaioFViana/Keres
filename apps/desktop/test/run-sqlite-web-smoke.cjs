const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const desktopRoot = path.resolve(__dirname, '..');
const clientRoot = path.resolve(desktopRoot, '..', 'client');
const electronBinary = require('electron');
const smokeEnvironment = {
  ...process.env,
  EXPO_PUBLIC_SQLITE_WEB_SMOKE_TEST: 'true',
};
delete smokeEnvironment.ELECTRON_RUN_AS_NODE;

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args.join(' ')} ended with ${signal || `code ${code}`}.`));
    });
  });
}

async function main() {
  await run('bun', ['run', 'export:web'], { cwd: clientRoot, env: smokeEnvironment });
  await run('bun', ['run', 'build:main'], { cwd: desktopRoot });
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'keres-sqlite-web-smoke-'));
  try {
    await run(electronBinary, ['.', '--sqlite-web-smoke-test', `--user-data-dir=${userDataDir}`], {
      cwd: desktopRoot,
      env: smokeEnvironment,
    });
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[sqlite-web-smoke]', error);
  process.exitCode = 1;
});
