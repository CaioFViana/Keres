import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';

describe('GET /kerescheck', () => {
  it('responds in memory without opening a server', async () => {
    const app = await createApp();

    const response = await app.handle(new Request('http://localhost/kerescheck'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ version: expect.any(String) });
  });

  it('returns a controlled response before accessing the database for protected routes', async () => {
    const app = await createApp();

    const response = await app.handle(new Request('http://localhost/stories/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Unauthenticated story', type: 'linear' }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized: User not authenticated.' });
  });
});
