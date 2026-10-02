import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  deliverDistFile,
  distFileCacheControl,
  resolveDistFile,
} from '../../src/services/distStaticDelivery';

const request = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/x', { headers });

function makeDist() {
  const dist = mkdtempSync(path.join(os.tmpdir(), 'keres-dist-'));
  mkdirSync(path.join(dist, 'assets'), { recursive: true });
  mkdirSync(path.join(dist, 'showcase', 'screens'), { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<html></html>');
  writeFileSync(path.join(dist, 'assets', 'index-DyvbuDyN.js'), 'const answer = 42;\n'.repeat(500));
  writeFileSync(path.join(dist, 'favicon.ico'), Buffer.alloc(2048, 7));
  writeFileSync(path.join(dist, 'showcase', 'screens', 'board.png'), Buffer.alloc(2048, 1));
  return dist;
}

describe('distFileCacheControl', () => {
  it('keeps what Vite names by its hash for a year, never to be asked about again', () => {
    for (const file of [
      '/assets/index-DyvbuDyN.js',
      '/assets/showcase-CWR1sC-l.css',
      '/assets/keres-logo-DoJdL9Yd.png',
    ]) {
      expect([file, distFileCacheControl(file)]).toEqual([
        file,
        'public, max-age=31536000, immutable',
      ]);
    }
  });

  it('keeps for a day what changes without changing its name', () => {
    for (const file of [
      '/favicon.ico',
      '/showcase/screens/board.en.dark.png',
      '/assets/logo.png',
    ]) {
      expect([file, distFileCacheControl(file)]).toEqual([file, 'public, max-age=86400']);
    }
  });
});

describe('resolveDistFile', () => {
  const dist = makeDist();

  it('finds a file, and nothing that is not one', () => {
    expect(resolveDistFile(dist, '/assets/index-DyvbuDyN.js')).toBe(
      path.normalize(path.join(dist, 'assets', 'index-DyvbuDyN.js')),
    );
    expect(resolveDistFile(dist, '/assets')).toBeNull();
    expect(resolveDistFile(dist, '/')).toBeNull();
    expect(resolveDistFile(dist, '')).toBeNull();
    expect(resolveDistFile(dist, '/assets/missing.js')).toBeNull();
  });

  it('refuses to leave the tree, however the path is written', () => {
    expect(resolveDistFile(dist, '/../secret')).toBeNull();
    expect(resolveDistFile(dist, '/assets/../../secret')).toBeNull();
    expect(resolveDistFile(dist, '/%2e%2e/secret')).toBeNull();
    expect(resolveDistFile(dist, '/%E0%A4%A')).toBeNull();
  });
});

describe('deliverDistFile', () => {
  const dist = makeDist();

  it('delivers a hashed file compressed, with a year of cache', async () => {
    const delivery = await deliverDistFile(
      dist,
      '/assets/index-DyvbuDyN.js',
      request({ 'accept-encoding': 'br' }),
    );

    expect(delivery?.status).toBe(200);
    expect(delivery?.headers['Content-Encoding']).toBe('br');
    expect(delivery?.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(delivery?.headers.Vary).toBe('Accept-Encoding');
    expect(new TextDecoder().decode(brotliDecompressSync(delivery!.body!))).toContain(
      'const answer',
    );
  });

  it('delivers the favicon compressed for a day, and a png as it is', async () => {
    const ico = await deliverDistFile(dist, '/favicon.ico', request({ 'accept-encoding': 'gzip' }));
    expect(ico?.headers['Content-Encoding']).toBe('gzip');
    expect(ico?.headers['Cache-Control']).toBe('public, max-age=86400');

    const png = await deliverDistFile(
      dist,
      '/showcase/screens/board.png',
      request({ 'accept-encoding': 'br' }),
    );
    expect(png?.headers['Content-Encoding']).toBeUndefined();
    expect(png?.headers['Content-Type']).toBe('image/png');
  });

  it('answers 304 to a browser that comes back with the tag', async () => {
    const first = await deliverDistFile(dist, '/favicon.ico', request({ 'accept-encoding': 'br' }));

    const again = await deliverDistFile(
      dist,
      '/favicon.ico',
      request({ 'accept-encoding': 'br', 'if-none-match': first!.headers.ETag }),
    );

    expect(again?.status).toBe(304);
    expect(again?.body).toBeNull();
  });

  it('has nothing to deliver for a path that is not a file', async () => {
    expect(await deliverDistFile(dist, '/assets/missing.js', request())).toBeNull();
    expect(await deliverDistFile(dist, '/../etc/passwd', request())).toBeNull();
  });
});
