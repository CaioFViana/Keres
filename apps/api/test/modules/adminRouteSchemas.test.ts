import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';

/**
 * Guards against schema drift: these admin routes declare a loose Elysia `query`/`body`
 * schema purely so swagger shows their shape, while a separate Zod schema does the real
 * validation inside the handler. Elysia silently strips any key not declared in its own
 * schema before the handler runs - if someone adds a field to the Zod schema later without
 * mirroring it here, that field would vanish with no error, and this is the test that would
 * catch it. Confirms a fully-populated, realistic request reaches `requireAdmin` (401, since
 * no real token was sent) instead of being rejected or silently trimmed by Elysia first
 * (which would show up as a 422 VALIDATION error instead).
 */
describe('admin route schemas accept every field their Zod counterpart does', () => {
  const authHeader = { authorization: 'Bearer not-a-real-token' };

  it('GET /api/admin/api-logs with every query field populated', async () => {
    const app = await createApp();
    const qs = new URLSearchParams({
      level: 'error',
      storyId: 'story-1',
      userId: 'user-1',
      search: 'boom',
      from: '2024-01-01',
      to: '2024-01-02',
      page: '2',
      pageSize: '10',
    });
    const res = await app.handle(
      new Request(`http://localhost/api/admin/logs?${qs}`, { headers: authHeader }),
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/recovery/deleted with every query field populated', async () => {
    const app = await createApp();
    const qs = new URLSearchParams({ entityType: 'Character', storyId: 'story-1' });
    const res = await app.handle(
      new Request(`http://localhost/api/admin/recovery/deleted?${qs}`, { headers: authHeader }),
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/recovery/operation-log with every query field populated', async () => {
    const app = await createApp();
    const qs = new URLSearchParams({
      storyId: 'story-1',
      entityType: 'Character',
      userId: 'user-1',
      operationType: 'update',
      from: '2024-01-01',
      to: '2024-01-02',
      page: '1',
      pageSize: '25',
    });
    const res = await app.handle(
      new Request(`http://localhost/api/admin/recovery/operation-log?${qs}`, {
        headers: authHeader,
      }),
    );
    expect(res.status).toBe(401);
  });

  it('PUT /api/admin/registration with every body field populated', async () => {
    const app = await createApp();
    const res = await app.handle(
      new Request('http://localhost/api/admin/registration-settings', {
        method: 'PUT',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({
          isRegistrationOpen: true,
          maxUsers: 100,
          autoManage: false,
          defaultTierId: 'tier-1',
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('PUT /api/admin/registration with nullable fields set to null', async () => {
    const app = await createApp();
    const res = await app.handle(
      new Request('http://localhost/api/admin/registration-settings', {
        method: 'PUT',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ maxUsers: null, defaultTierId: null }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/tiers with every body field populated', async () => {
    const app = await createApp();
    const res = await app.handle(
      new Request('http://localhost/api/admin/tiers', {
        method: 'POST',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Gold',
          isDefault: true,
          maxStories: 10,
          maxEntitiesPerStory: 100,
          maxEntitiesTotal: 1000,
          maxStorageBytesPerStory: 5000,
          maxStorageBytesTotal: 50000,
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('PUT /api/admin/tiers/:id with a partial body (only some fields)', async () => {
    const app = await createApp();
    const res = await app.handle(
      new Request('http://localhost/api/admin/tiers/tier-1', {
        method: 'PUT',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ maxStories: null }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/users with every query field populated', async () => {
    const app = await createApp();
    const qs = new URLSearchParams({
      search: 'ana',
      isAdmin: 'true',
      isDeleted: 'false',
      tierId: 'tier-1',
      page: '1',
      pageSize: '25',
    });
    const res = await app.handle(
      new Request(`http://localhost/api/admin/users?${qs}`, { headers: authHeader }),
    );
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/ws-ticket still resolves past its new detail block', async () => {
    const app = await createApp();
    const res = await app.handle(
      new Request('http://localhost/api/auth/ws-ticket', { method: 'POST', headers: authHeader }),
    );
    // No `user` decorated from an invalid token -> the handler's own 401, not a schema 422.
    expect(res.status).toBe(401);
  });
});
