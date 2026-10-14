import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PRECOMPRESSED_MANIFEST,
  precompressedFor,
  resetPrecompressedManifests,
} from '../../src/services/precompressedAssets';

let root: string;

function write(relative: string, content: string | Uint8Array): string {
  const full = path.join(root, relative);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

function manifest(files: Record<string, { hash: string; encodings: string[] }>): void {
  write(PRECOMPRESSED_MANIFEST, JSON.stringify({ version: 1, files }));
}

beforeEach(() => {
  resetPrecompressedManifests();
  root = mkdtempSync(path.join(tmpdir(), 'keres-precompressed-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('precompressedFor', () => {
  it('reads the copy the manifest lists for the same bytes', () => {
    const file = write('assets/app.js', 'raw');
    write('assets/app.js.br', new Uint8Array([1, 2, 3]));
    write('assets/app.js.gz', new Uint8Array([4, 5]));
    manifest({ 'assets/app.js': { hash: 'h1', encodings: ['br', 'gzip'] } });

    const lookup = precompressedFor(root, file);

    expect(lookup('h1', 'br')?.()).toEqual(new Uint8Array([1, 2, 3]));
    expect(lookup('h1', 'gzip')?.()).toEqual(new Uint8Array([4, 5]));
  });

  it('refuses a copy made for other bytes', () => {
    const file = write('app.js', 'raw');
    write('app.js.br', new Uint8Array([1]));
    manifest({ 'app.js': { hash: 'old', encodings: ['br'] } });

    expect(precompressedFor(root, file)('new', 'br')).toBeNull();
  });

  it('refuses an encoding the manifest does not list, and a copy that is gone', () => {
    const file = write('app.js', 'raw');
    write('app.js.br', new Uint8Array([1]));
    manifest({ 'app.js': { hash: 'h', encodings: ['br'] } });
    const lookup = precompressedFor(root, file);

    expect(lookup('h', 'gzip')).toBeNull();

    rmSync(`${file}.br`);
    resetPrecompressedManifests();
    expect(precompressedFor(root, file)('h', 'br')).toBeNull();
  });

  it('refuses a file the manifest does not know', () => {
    const file = write('other.js', 'raw');
    manifest({ 'app.js': { hash: 'h', encodings: ['br'] } });

    expect(precompressedFor(root, file)('h', 'br')).toBeNull();
  });

  it('finds nothing in a folder with no manifest, or with one that cannot be read', () => {
    const file = write('app.js', 'raw');
    write('app.js.br', new Uint8Array([1]));
    expect(precompressedFor(root, file)('h', 'br')).toBeNull();

    resetPrecompressedManifests();
    write(PRECOMPRESSED_MANIFEST, '{ not json');
    expect(precompressedFor(root, file)('h', 'br')).toBeNull();

    resetPrecompressedManifests();
    write(PRECOMPRESSED_MANIFEST, JSON.stringify({ version: 2, files: {} }));
    expect(precompressedFor(root, file)('h', 'br')).toBeNull();
  });
});
