import { randomBytes } from 'node:crypto';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import {
  isCompressibleContentType,
  matchesEntityTag,
  negotiateContentEncoding,
  StaticDelivery,
} from '../../src/services/staticDelivery';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const source = new TextEncoder().encode('const answer = 42;\n'.repeat(400));

const input = (over: Partial<Parameters<StaticDelivery['deliver']>[0]> = {}) => ({
  key: '/dist/app.js',
  version: '1-1',
  contentType: 'text/javascript; charset=utf-8',
  cacheControl: 'public, max-age=31536000, immutable',
  load: () => source,
  request: { acceptEncoding: 'gzip, deflate, br' },
  ...over,
});

describe('negotiateContentEncoding', () => {
  it.each([
    ['gzip, deflate, br', 'br'],
    ['gzip, deflate', 'gzip'],
    ['br;q=0.5, gzip;q=1', 'gzip'],
    ['gzip;q=0.8, br;q=0.8', 'br'],
    ['*', 'br'],
    ['x-gzip', 'gzip'],
    ['identity', null],
    ['br;q=0, gzip;q=0', null],
    ['br;q=0, gzip', 'gzip'],
    ['', null],
    [undefined, null],
  ])('answers %j with %j', (header, expected) => {
    expect(negotiateContentEncoding(header)).toBe(expected);
  });
});

describe('isCompressibleContentType', () => {
  it('compresses text and code, and leaves what is compressed already', () => {
    for (const type of [
      'text/html; charset=utf-8',
      'text/javascript; charset=utf-8',
      'application/wasm',
      'application/json',
      'image/svg+xml',
      'image/x-icon',
      'font/ttf',
    ]) {
      expect([type, isCompressibleContentType(type)]).toEqual([type, true]);
    }
    for (const type of ['image/png', 'image/jpeg', 'font/woff2', 'application/octet-stream']) {
      expect([type, isCompressibleContentType(type)]).toEqual([type, false]);
    }
  });
});

describe('matchesEntityTag', () => {
  it('reads strong, weak, listed and wildcard validators', () => {
    expect(matchesEntityTag('"a"', '"a"')).toBe(true);
    expect(matchesEntityTag('W/"a"', '"a"')).toBe(true);
    expect(matchesEntityTag('"x", "a"', '"a"')).toBe(true);
    expect(matchesEntityTag('*', '"a"')).toBe(true);
    expect(matchesEntityTag('"b"', '"a"')).toBe(false);
    expect(matchesEntityTag(null, '"a"')).toBe(false);
  });
});

describe('StaticDelivery', () => {
  it('answers in brotli when the browser takes it, and the bytes decode to the file', async () => {
    const delivery = await new StaticDelivery().deliver(input());

    expect(delivery.status).toBe(200);
    expect(delivery.headers['Content-Encoding']).toBe('br');
    expect(delivery.headers.Vary).toBe('Accept-Encoding');
    expect(delivery.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(delivery.body!.length).toBeLessThan(source.length / 10);
    expect(text(brotliDecompressSync(delivery.body!))).toBe(text(source));
  });

  it('answers in gzip to a browser on plain HTTP, which offers no brotli', async () => {
    const delivery = await new StaticDelivery().deliver(
      input({ request: { acceptEncoding: 'gzip, deflate' } }),
    );

    expect(delivery.headers['Content-Encoding']).toBe('gzip');
    expect(text(gunzipSync(delivery.body!))).toBe(text(source));
  });

  it('sends the bytes as they are to a client that accepts nothing, but still says it varies', async () => {
    const delivery = await new StaticDelivery().deliver(input({ request: {} }));

    expect(delivery.headers['Content-Encoding']).toBeUndefined();
    expect(delivery.headers.Vary).toBe('Accept-Encoding');
    expect(text(delivery.body!)).toBe(text(source));
  });

  it('does not compress what is already compressed, nor what is too small to matter', async () => {
    const png = await new StaticDelivery().deliver(input({ contentType: 'image/png' }));
    expect(png.headers['Content-Encoding']).toBeUndefined();
    // It still replaces the CORS plugin's `Vary: *`, which would stop a browser reusing the file.
    expect(png.headers.Vary).toBe('Accept-Encoding');

    const tiny = await new StaticDelivery().deliver(
      input({ load: () => new TextEncoder().encode('{}') }),
    );
    expect(tiny.headers['Content-Encoding']).toBeUndefined();
  });

  it('sends the bytes as they are when compression would not make them smaller', async () => {
    const noise = new Uint8Array(randomBytes(4096));

    const delivery = await new StaticDelivery().deliver(
      input({ contentType: 'application/wasm', load: () => noise }),
    );

    expect(delivery.headers['Content-Encoding']).toBeUndefined();
    expect(delivery.body).toEqual(noise);
  });

  it('answers 304 with no body to a browser that holds the same representation', async () => {
    const delivery = new StaticDelivery();
    const first = await delivery.deliver(input());

    const again = await delivery.deliver(
      input({ request: { acceptEncoding: 'br', ifNoneMatch: first.headers.ETag } }),
    );

    expect(again.status).toBe(304);
    expect(again.body).toBeNull();
    expect(again.headers.ETag).toBe(first.headers.ETag);
  });

  it('gives each encoding its own entity tag, so a browser never revalidates against the wrong bytes', async () => {
    const delivery = new StaticDelivery();
    const brotli = await delivery.deliver(input());
    const gzip = await delivery.deliver(input({ request: { acceptEncoding: 'gzip' } }));
    const plain = await delivery.deliver(input({ request: {} }));

    expect(new Set([brotli.headers.ETag, gzip.headers.ETag, plain.headers.ETag]).size).toBe(3);
    const gzipAgainstBrotliTag = await delivery.deliver(
      input({ request: { acceptEncoding: 'gzip', ifNoneMatch: brotli.headers.ETag } }),
    );
    expect(gzipAgainstBrotliTag.status).toBe(200);
  });

  it('compresses a file once, whoever asks and however many ask together', async () => {
    const load = vi.fn(() => source);
    const delivery = new StaticDelivery();

    await Promise.all([
      delivery.deliver(input({ load })),
      delivery.deliver(input({ load })),
      delivery.deliver(input({ load })),
    ]);
    const loadsAfterBurst = load.mock.calls.length;
    await delivery.deliver(input({ load }));

    // One read for the entity tag, one for the compression: never one per request.
    expect(loadsAfterBurst).toBe(2);
    expect(load.mock.calls.length).toBe(loadsAfterBurst);
  });

  it('starts over when the file changes', async () => {
    const delivery = new StaticDelivery();
    const first = await delivery.deliver(input());

    const second = await delivery.deliver(
      input({
        version: '2-2',
        load: () => new TextEncoder().encode('const other = 1;\n'.repeat(400)),
      }),
    );

    expect(second.headers.ETag).not.toBe(first.headers.ETag);
    expect(text(brotliDecompressSync(second.body!))).toContain('const other = 1;');
  });

  it('warms both encodings so the first visitor finds them done', async () => {
    const delivery = new StaticDelivery();
    const load = vi.fn(() => source);
    await delivery.warm({ ...input({ load }) });
    const loadsAfterWarm = load.mock.calls.length;

    await delivery.deliver(input({ load }));
    await delivery.deliver(input({ load, request: { acceptEncoding: 'gzip' } }));

    expect(load.mock.calls.length).toBe(loadsAfterWarm);
  });
});
