import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { precompressDirectory } from '@scripts/precompress-dist';
import {
  PRECOMPRESSED_MANIFEST,
  precompressedFor,
  resetPrecompressedManifests,
} from '@/services/precompressedAssets';
import { contentHash, StaticDelivery } from '@/services/staticDelivery';

const script = 'const answer = 42;\n'.repeat(600);
let root: string;

function write(relative: string, content: string | Uint8Array): string {
  const full = path.join(root, relative);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

beforeEach(() => {
  resetPrecompressedManifests();
  root = mkdtempSync(path.join(tmpdir(), 'keres-precompress-dist-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('precompressDirectory', () => {
  it('writes a brotli and a gzip copy beside a file that compresses, and lists it with its hash', () => {
    const file = write('assets/app.js', script);

    const result = precompressDirectory(root, { brotliQuality: 5 });

    expect(result.files).toBe(1);
    expect(brotliDecompressSync(readFileSync(`${file}.br`)).toString()).toBe(script);
    expect(gunzipSync(readFileSync(`${file}.gz`)).toString()).toBe(script);
    const manifest = JSON.parse(readFileSync(path.join(root, PRECOMPRESSED_MANIFEST), 'utf8'));
    expect(manifest).toEqual({
      version: 1,
      files: {
        'assets/app.js': {
          hash: contentHash(new Uint8Array(Buffer.from(script))),
          encodings: ['br', 'gzip'],
        },
      },
    });
  });

  it('leaves alone HTML, small files, and formats that are compressed already', () => {
    write('index.html', script);
    write('small.js', 'let a = 1;');
    write('image.png', new Uint8Array(randomBytes(4096)));

    const result = precompressDirectory(root, { brotliQuality: 5 });

    expect(result.files).toBe(0);
    for (const name of ['index.html', 'small.js', 'image.png']) {
      expect(existsSync(path.join(root, `${name}.br`))).toBe(false);
      expect(existsSync(path.join(root, `${name}.gz`))).toBe(false);
    }
  });

  it('keeps no copy that does not come out smaller than the file', () => {
    const noise = new Uint8Array(randomBytes(4096));
    const file = write('data.wasm', noise);

    const result = precompressDirectory(root, { brotliQuality: 5 });

    expect(result.files).toBe(0);
    expect(existsSync(`${file}.br`)).toBe(false);
  });

  it('makes only the encodings it is asked for', () => {
    const file = write('app.js', script);

    precompressDirectory(root, { encodings: ['gzip'] });

    expect(existsSync(`${file}.gz`)).toBe(true);
    expect(existsSync(`${file}.br`)).toBe(false);
    const manifest = JSON.parse(readFileSync(path.join(root, PRECOMPRESSED_MANIFEST), 'utf8'));
    expect(manifest.files['app.js'].encodings).toEqual(['gzip']);
  });

  it('starts from nothing when it runs again: copies of a file that is gone do not stay', () => {
    const file = write('app.js', script);
    precompressDirectory(root, { brotliQuality: 5 });
    rmSync(file);
    write('other.js', script.replace('42', '43'));

    precompressDirectory(root, { brotliQuality: 5 });

    expect(existsSync(`${file}.br`)).toBe(false);
    expect(existsSync(`${file}.gz`)).toBe(false);
    const manifest = JSON.parse(readFileSync(path.join(root, PRECOMPRESSED_MANIFEST), 'utf8'));
    expect(Object.keys(manifest.files)).toEqual(['other.js']);
  });

  it('feeds the server: the answer is the build copy, and a file changed afterwards is not', async () => {
    const file = write('assets/app.js', script);
    precompressDirectory(root, { brotliQuality: 5 });
    const built = new Uint8Array(readFileSync(`${file}.br`));
    const request = { acceptEncoding: 'br' };
    const base = {
      key: file,
      version: '1-1',
      contentType: 'text/javascript; charset=utf-8',
      cacheControl: 'public, max-age=60',
    };

    const served = await new StaticDelivery().deliver({
      ...base,
      load: () => new Uint8Array(readFileSync(file)),
      precompressed: precompressedFor(root, file),
      request,
    });
    expect(served.body).toEqual(built);

    // The file is replaced after the build: its copy no longer describes it.
    const changed = 'const answer = 43;\n'.repeat(600);
    writeFileSync(file, changed);
    const afterChange = await new StaticDelivery().deliver({
      ...base,
      load: () => new Uint8Array(readFileSync(file)),
      precompressed: precompressedFor(root, file),
      request,
    });
    expect(afterChange.body).not.toEqual(built);
    expect(brotliDecompressSync(afterChange.body!).toString()).toBe(changed);
  });
});
