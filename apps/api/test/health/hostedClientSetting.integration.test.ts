import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';
import { request, registerUser, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

let admin: TestUser;

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
});

describe('hosted client setting', () => {
  it('defaults to enabled and replaces the root client with a server landing when disabled', async () => {
    const initial = await request('GET', '/admin/showcase-settings', { token: admin.token });
    expect(initial.status).toBe(200);
    expect(initial.data.isHostedClientEnabled).toBe(true);

    const updated = await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { isHostedClientEnabled: false },
    });
    expect(updated.status).toBe(200);
    expect(updated.data.isHostedClientEnabled).toBe(false);
    expect(updated.data.isShowcaseEnabled).toBe(false);

    const app = await createApp();
    const response = await app.handle(new Request('http://localhost/'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/html/);
    expect(response.headers.get('Content-Security-Policy')).toContain("style-src 'unsafe-inline'");

    const html = await response.text();
    expect(html).toContain('Keres Server');
    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/showcase"');
    expect(html).not.toContain('keres-hosted');
  });
});
