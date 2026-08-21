import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';

/**
 * Sanity check for this session's new/changed `response` schemas across auth, friend,
 * storyPermission, story, sync and media routes. Can only exercise the branches that don't
 * need a live Postgres connection (this sandbox has none) - every route here throws its own
 * 401 before touching the DB, which is exactly the shape of check most of these new
 * status-keyed schemas needed to get right (a wrong schema key, or a schema that doesn't
 * match what onError actually returns, would show up here as something other than a clean
 * 401 with an intact `message`).
 */
describe('new response schemas do not break DB-independent error branches', () => {
  const badAuth = { authorization: 'Bearer not-a-real-token' };

  async function expectCleanUnauthorized(method: string, path: string, extra: RequestInit = {}) {
    const app = await createApp();
    const res = await app.handle(
      new Request(`http://localhost${path}`, { method, headers: badAuth, ...extra }),
    );
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toHaveProperty('message');
    return body;
  }

  it('POST /auth/ws-ticket', async () => {
    await expectCleanUnauthorized('POST', '/auth/ws-ticket');
  });

  it('friend routes', async () => {
    await expectCleanUnauthorized('POST', '/friend/request/target-1');
    await expectCleanUnauthorized('PUT', '/friend/accept/target-1');
    await expectCleanUnauthorized('DELETE', '/friend/decline/target-1');
    await expectCleanUnauthorized('DELETE', '/friend/request/target-1');
    await expectCleanUnauthorized('POST', '/friend/blacklist/target-1');
    await expectCleanUnauthorized('DELETE', '/friend/blacklist/target-1');
    await expectCleanUnauthorized('DELETE', '/friend/unfriend/target-1');
    await expectCleanUnauthorized('GET', '/friend/');
  });

  it('storyPermission routes', async () => {
    // CreateStoryPermissionSchema requires real ULID-shaped ids - a fake ID doesn't reach the
    // handler at all (fails body validation first), so this needs a plausible one to actually
    // exercise the 401 check.
    const ulid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    await expectCleanUnauthorized('POST', '/story-permissions/', {
      headers: { ...badAuth, 'content-type': 'application/json' },
      body: JSON.stringify({ storyId: ulid, targetUserId: ulid, permissionType: 'reader' }),
    });
    await expectCleanUnauthorized('DELETE', `/story-permissions/story/${ulid}/user/${ulid}`);
    await expectCleanUnauthorized('GET', `/story-permissions/story/${ulid}`);
  });

  it('story routes', async () => {
    await expectCleanUnauthorized('POST', '/stories/', {
      headers: { ...badAuth, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'X', type: 'linear' }),
    });
    await expectCleanUnauthorized('GET', '/stories/s/export');
    // POST /import's body (FullStoryExportSchema) is large, pre-existing, and untouched by
    // this session - not worth constructing a conforming payload just to reach its own 401
    // check, which is no different in kind from the two above.
  });

  it('sync push', async () => {
    await expectCleanUnauthorized('POST', '/sync/s', {
      headers: { ...badAuth, 'content-type': 'application/json' },
      body: JSON.stringify([]),
    });
  });

  it('media upload', async () => {
    const form = new FormData();
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' }));
    const app = await createApp();
    const res = await app.handle(
      new Request('http://localhost/media/s/blobs/00000000000000000000000000000000', {
        method: 'POST',
        headers: badAuth,
        body: form,
      }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toHaveProperty('message');
  });

  it('admin create/update user still reject a clean, valid-shaped body (no auth) with 401, not a schema error', async () => {
    // Guards against the tightened body schema (item 2) rejecting realistic input at the
    // Elysia layer before requireAdmin even runs.
    await expectCleanUnauthorized('POST', '/admin/api/users', {
      headers: { ...badAuth, 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ana', password: 'a-real-password-123', isAdmin: false }),
    });
    await expectCleanUnauthorized('PUT', '/admin/api/users/some-id', {
      headers: { ...badAuth, 'content-type': 'application/json' },
      body: JSON.stringify({ bio: 'a normal bio' }),
    });
  });
});
