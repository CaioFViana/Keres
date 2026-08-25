/**
 * Packages Keres Server: the Bun binary + libSQL's native sidecar + SQL + the admin panel.
 *
 * `bun build --compile` on its own does not resolve `@libsql/<platform>` (the native addon is a
 * dynamic `require()`). The zip carries that folder next to the executable. Migrations and the
 * admin's dist go alongside too - this Bun version's `--asset` does not embed folders.
 *
 * Icon on Windows: Bun 1.2.19's `--windows-icon` prints "Failed to set executable icon" and leaves
 * Bun's icon in place. rcedit (Electron) writes the .ico after the compile.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import pngToIco from 'png-to-ico';

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(apiRoot, '..', '..');
const outRoot = path.join(apiRoot, 'dist-server');
const toolsDir = path.join(apiRoot, '.tools');
const bundleName = 'keres-server';
const bundleDir = path.join(outRoot, bundleName);
const exeName = process.platform === 'win32' ? 'keres-server.exe' : 'keres-server';
const RCEDIT_URL = 'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe';

function run(command: string, args: string[], cwd: string = repoRoot): void {
  // Sem `shell: true`: no Windows o cmd.exe partia `--windows-title=Keres Server`
  // em entry points extra (`Server`, `home`, `API`).
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
  }
}

function platformSlug(): string {
  const osName =
    process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `${osName}-${arch}`;
}

function zipBundle(zipFileName: string): void {
  if (process.platform === 'win32') {
    run('tar', ['-a', '-cf', zipFileName, bundleName], outRoot);
    return;
  }
  run('zip', ['-r', zipFileName, bundleName], outRoot);
}

function libsqlNativePackage(): string {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32' && arch === 'x64') return '@libsql/win32-x64-msvc';
  if (platform === 'linux' && arch === 'x64') return '@libsql/linux-x64-gnu';
  if (platform === 'linux' && arch === 'arm64') return '@libsql/linux-arm64-gnu';
  if (platform === 'darwin' && arch === 'arm64') return '@libsql/darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return '@libsql/darwin-x64';
  throw new Error(`No libSQL native package mapping for ${platform}/${arch}`);
}

/**
 * Copies one of the three web bundles (panel, showcase, client) and requires an `index.html` at
 * the destination: a missing or half-built `dist` only showed up later, as the server answering
 * 404 - the client's copy was once conditional and a release shipped without it with not a single
 * line of warning.
 */
function copyWebBundle(source: string, bundleFolder: string, buildScript: string): void {
  if (!existsSync(path.join(source, 'index.html'))) {
    throw new Error(
      `Bundle web ausente em ${source} - \`bun run ${buildScript}\` não produziu index.html.`,
    );
  }
  cpSync(source, path.join(bundleDir, bundleFolder), { recursive: true });
}

async function ensureRcedit(): Promise<string> {
  mkdirSync(toolsDir, { recursive: true });
  const dest = path.join(toolsDir, 'rcedit-x64.exe');
  if (existsSync(dest) && statSync(dest).size > 100_000) {
    return dest;
  }
  console.log(`Downloading rcedit from ${RCEDIT_URL}`);
  const response = await fetch(RCEDIT_URL);
  if (!response.ok) {
    throw new Error(`Could not download rcedit: HTTP ${response.status}`);
  }
  writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  return dest;
}

async function applyWindowsIcon(exePath: string): Promise<void> {
  const png = path.join(repoRoot, 'apps', 'client', 'assets', 'images', 'desktop_icon.png');
  const ico = path.join(toolsDir, 'keres-server.ico');
  mkdirSync(toolsDir, { recursive: true });
  writeFileSync(ico, await pngToIco(png));
  const rcedit = await ensureRcedit();
  run(rcedit, [
    exePath,
    '--set-icon',
    ico,
    '--set-version-string',
    'FileDescription',
    'Keres Server',
    '--set-version-string',
    'ProductName',
    'Keres Server',
  ]);
}

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(bundleDir, { recursive: true });

// The web bundles (panel, showcase, client) come from the API's `prebuild` - see the `package.json`
// here. This script packages, it does not build; if a bundle is missing, `copyWebBundle` says which
// one and how to generate it, instead of the zip coming out half-empty and the server answering 404.

const exePath = path.join(bundleDir, exeName);
run('bun', [
  'build',
  path.join(apiRoot, 'src', 'launcher.ts'),
  '--compile',
  '--no-compile-autoload-dotenv',
  '--outfile',
  exePath,
]);

if (process.platform === 'win32') {
  await applyWindowsIcon(exePath);
}

cpSync(path.join(apiRoot, 'drizzle'), path.join(bundleDir, 'drizzle'), { recursive: true });
cpSync(path.join(apiRoot, 'drizzle-sqlite'), path.join(bundleDir, 'drizzle-sqlite'), {
  recursive: true,
});
copyWebBundle(path.join(repoRoot, 'apps', 'admin', 'dist'), 'admin-dist', 'admin:build');
copyWebBundle(
  path.join(repoRoot, 'apps', 'admin', 'dist-showcase'),
  'dist-showcase',
  'admin:build',
);
copyWebBundle(path.join(repoRoot, 'apps', 'client', 'dist'), 'client-dist', 'client:build');
cpSync(
  path.join(repoRoot, 'apps', 'client', 'assets', 'images', 'desktop_icon.png'),
  path.join(bundleDir, 'desktop_icon.png'),
);
cpSync(path.join(apiRoot, 'packaging', 'README.md'), path.join(bundleDir, 'README.md'));

const nativeName = libsqlNativePackage();
const nativeSource = path.join(repoRoot, 'node_modules', ...nativeName.split('/'));
cpSync(nativeSource, path.join(bundleDir, 'node_modules', ...nativeName.split('/')), {
  recursive: true,
});

const version = JSON.parse(readFileSync(path.join(apiRoot, 'package.json'), 'utf8'))
  .version as string;
const zipFileName = `Keres-Server-${platformSlug()}-${version}.zip`;
zipBundle(zipFileName);

console.log(`Keres Server packaged at ${bundleDir}`);
console.log(`Archive: ${path.join(outRoot, zipFileName)}`);
