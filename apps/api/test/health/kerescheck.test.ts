import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';

describe('GET /kerescheck', () => {
  it('responds in memory without opening a server', async () => {
    const app = await createApp();

    const response = await app.handle(new Request('http://localhost/kerescheck'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ version: expect.any(String) });
  });

  it('serves /favicon.ico as the generated ICO (or the source PNG before an admin build)', async () => {
    const app = await createApp();

    const response = await app.handle(new Request('http://localhost/favicon.ico'));

    expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const isIco = bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    expect(isIco || isPng).toBe(true);
    expect(response.headers.get('content-type')).toMatch(
      isIco ? /image\/(x-icon|vnd\.microsoft\.icon)/ : /image\/png/,
    );
  });

  it('returns a controlled response before accessing the database for protected routes', async () => {
    const app = await createApp();

    const response = await app.handle(
      new Request('http://localhost/stories/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Unauthenticated story', type: 'linear' }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: 'Unauthorized: User not authenticated.',
    });
  });
});
