/**
 * Fetches the pinned PDF serif matrices into `apps/api/assets/fonts/` (gitignored).
 *
 * The manifest (`packages/shared/manuscript/compile/export/pdfFonts.manifest.json`) pins an
 * immutable `googleFontsCommit` plus a sha256 per file; every download is hash-verified before
 * it counts, and a file already on disk with the right size and hash is never re-downloaded -
 * so this is a network call only the first time, and later builds reuse the cache. Without
 * network and without cached files it warns (not throws): the server still runs, manuscripts
 * just fall back to the WinAnsi Times path.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fontsDir = path.join(apiRoot, 'assets', 'fonts');

type ManifestFile = { path: string; sha256: string; bytes: number };
type Manifest = {
  googleFontsCommit: string;
  files: Record<string, ManifestFile>;
  packs: Record<string, { files: string[] }>;
};

function loadManifest(): Manifest {
  // apps/api/scripts -> apps/api -> repo root -> packages/shared/...
  const candidate = path.join(
    apiRoot,
    '..',
    '..',
    'packages',
    'shared',
    'manuscript',
    'compile',
    'export',
    'pdfFonts.manifest.json',
  );
  if (!existsSync(candidate)) {
    throw new Error(`PDF font manifest not found at ${candidate}.`);
  }
  return JSON.parse(readFileSync(candidate, 'utf8')) as Manifest;
}

function valid(dest: string, entry: ManifestFile): boolean {
  return existsSync(dest) && statSync(dest).size === entry.bytes && sha256(dest) === entry.sha256;
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function downloadUrl(commit: string, repoPath: string): string {
  const encoded = repoPath.split('/').map(encodeURIComponent).join('/');
  return `https://cdn.jsdelivr.net/gh/google/fonts@${commit}/${encoded}`;
}

const manifest = loadManifest();
mkdirSync(fontsDir, { recursive: true });

let fetched = 0;
let reused = 0;
for (const [name, entry] of Object.entries(manifest.files)) {
  const dest = path.join(fontsDir, name);
  if (valid(dest, entry)) {
    reused += 1;
    continue;
  }
  const url = downloadUrl(manifest.googleFontsCommit, entry.path);
  console.log(`Fetching ${name} (${(entry.bytes / 1024 / 1024).toFixed(1)} MB)...`);
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    console.warn(`Could not download ${name} (${url}): ${String(error)}.`);
    console.warn('Server builds and runs without it; PDF manuscripts fall back to Times.');
    continue;
  }
  if (!response.ok) {
    console.warn(`Could not download ${name}: HTTP ${response.status}. Continuing without it.`);
    continue;
  }
  const partial = `${dest}.partial`;
  writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
  const digest = sha256(partial);
  if (digest !== entry.sha256) {
    console.warn(`Hash mismatch for ${name}: expected ${entry.sha256}, got ${digest}. Discarded.`);
    continue;
  }
  renameSync(partial, dest);
  fetched += 1;
}

console.log(`PDF fonts: ${reused} reused from cache, ${fetched} fetched into ${fontsDir}.`);
