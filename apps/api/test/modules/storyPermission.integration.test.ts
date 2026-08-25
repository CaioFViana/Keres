import { beforeEach, describe, expect, it } from 'vitest';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let bia: TestUser;
let storyId: string;

const grant = (token: string, targetUserId: string, permissionType: string, story = storyId) =>
  request('POST', '/story-permissions/', {
    token,
    body: { storyId: story, targetUserId, permissionType },
  });

const revoke = (token: string, targetUserId: string, story = storyId) =>
  request('DELETE', `/story-permissions/story/${story}/user/${targetUserId}`, { token });

const listFor = (token: string, story = storyId) =>
  request('GET', `/story-permissions/story/${story}`, { token });

const pull = (token: string, story = storyId) =>
  request('GET', `/sync/${story}/pull`, { token, query: { lastOperationVersion: 0 } });

/** Sharing a story is only allowed between friends, so the friendship comes first. */
async function befriend(a: TestUser, b: TestUser) {
  const requested = await request('POST', `/friend/request/${b.userId}`, { token: a.token });
  if (requested.status >= 400) {
    throw new Error(
      `Falha ao pedir amizade (${requested.status}): ${JSON.stringify(requested.data)}`,
    );
  }
  const accepted = await request('PUT', `/friend/accept/${a.userId}`, { token: b.token });
  if (accepted.status >= 400) {
    throw new Error(
      `Falha ao aceitar amizade (${accepted.status}): ${JSON.stringify(accepted.data)}`,
    );
  }
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  await befriend(ana, bia);
  const { data } = await request('POST', '/stories/', {
    token: ana.token,
    body: { title: 'A Queda', type: 'linear' },
  });
  storyId = data.id;
});

describe('POST /story-permissions/', () => {
  it('lets the owner share a story as a reader', async () => {
    const { status } = await grant(ana.token, bia.userId, 'reader');

    expect(status).toBe(200);
    const { data } = await listFor(ana.token);
    expect(data.some((permission: any) => permission.userId === bia.userId)).toBe(true);
  });

  it('makes the story reachable for the person it was shared with', async () => {
    const before = await request('GET', '/sync/pullpreviews', { token: bia.token });
    expect(before.data.storyPreviews).toEqual([]);

    await grant(ana.token, bia.userId, 'reader');

    const after = await request('GET', '/sync/pullpreviews', { token: bia.token });
    expect(after.data.storyPreviews).toEqual([
      expect.objectContaining({ storyId, role: 'reader' }),
    ]);
  });

  it.each(['reader', 'writer'])(
    'reports the granted %s role back to the collaborator',
    async (permissionType) => {
      await grant(ana.token, bia.userId, permissionType);

      const { data } = await pull(bia.token);

      expect(data.role).toBe(permissionType);
    },
  );

  it('updates an existing grant instead of duplicating it', async () => {
    await grant(ana.token, bia.userId, 'reader');
    await grant(ana.token, bia.userId, 'writer');

    const { data } = await listFor(ana.token);

    expect(data.filter((permission: any) => permission.userId === bia.userId)).toHaveLength(1);
    expect((await pull(bia.token)).data.role).toBe('writer');
  });

  it('refuses to let a collaborator share the story onward', async () => {
    await grant(ana.token, bia.userId, 'writer');
    const carla = await registerUser('carla');
    await befriend(bia, carla);

    const { status } = await grant(bia.token, carla.userId, 'reader');

    expect(status).toBe(403);
  });

  it('refuses to share a story with someone who is not a friend', async () => {
    const estranha = await registerUser('estranha');

    const { status, data } = await grant(ana.token, estranha.userId, 'reader');

    expect(status).toBe(403);
    expect(data.message).toBe('Permission can only be granted to friends.');
  });

  it('refuses to grant the owner a permission on their own story', async () => {
    const { status, data } = await grant(ana.token, ana.userId, 'writer');

    expect(status).toBe(400);
    expect(data.message).toMatch(/already has full permissions/);
  });

  it('refuses a grant on a story the caller does not own', async () => {
    const { data: outra } = await request('POST', '/stories/', {
      token: bia.token,
      body: { title: 'Outra', type: 'linear' },
    });

    const { status } = await grant(ana.token, bia.userId, 'reader', outra.id);

    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('rejects a permission type that does not exist', async () => {
    const { status } = await grant(ana.token, bia.userId, 'dono');

    expect(status).toBe(422);
  });

  it('requires a session', async () => {
    const { status } = await request('POST', '/story-permissions/', {
      body: { storyId, targetUserId: bia.userId, permissionType: 'reader' },
    });

    expect(status).toBe(401);
  });
});

describe('DELETE /story-permissions/story/:storyId/user/:targetUserId', () => {
  it('takes the story away from the collaborator', async () => {
    await grant(ana.token, bia.userId, 'reader');

    const { status } = await revoke(ana.token, bia.userId);

    expect(status).toBe(200);
    const { data } = await request('GET', '/sync/pullpreviews', { token: bia.token });
    expect(data.storyPreviews).toEqual([]);
  });

  it('refuses a revoke from someone who does not own the story', async () => {
    await grant(ana.token, bia.userId, 'writer');

    const { status } = await revoke(bia.token, bia.userId);

    expect(status).toBe(403);
  });

  it('requires a session', async () => {
    const { status } = await request(
      'DELETE',
      `/story-permissions/story/${storyId}/user/${bia.userId}`,
    );

    expect(status).toBe(401);
  });

  /**
   * `StoryPermissionService` used to throw a plain `Error` here (message not prefixed with
   * "Unauthorized", the only prefix the route's error-mapping translates to a status) - it
   * fell through to Elysia's generic 500 fallback instead of the 404 a "not found" case should
   * be. No prior grant exists for bia on this story, so the permission lookup finds nothing.
   */
  it('answers 404, not a generic 500, when revoking a permission that was never granted', async () => {
    const { status, data } = await revoke(ana.token, bia.userId);

    expect(status).toBe(404);
    expect(data.message).toBe('Story permission not found for this user on this story.');
  });
});

describe('GET /story-permissions/story/:storyId', () => {
  it('starts empty for a story that was never shared', async () => {
    const { status, data } = await listFor(ana.token);

    expect(status).toBe(200);
    expect(data).toEqual([]);
  });

  it('refuses to show the collaborator list to a collaborator', async () => {
    await grant(ana.token, bia.userId, 'writer');

    const { status } = await listFor(bia.token);

    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('refuses to show the list for a story that does not exist', async () => {
    const { status } = await listFor(ana.token, newId());

    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('requires a session', async () => {
    const { status } = await request('GET', `/story-permissions/story/${storyId}`);

    expect(status).toBe(401);
  });
});

describe('what a collaborator can do with the story', () => {
  it('lets a reader export it', async () => {
    await grant(ana.token, bia.userId, 'reader');

    const { status } = await request('GET', `/stories/${storyId}/export`, { token: bia.token });

    expect(status).toBe(200);
  });

  /**
   * Revocation is a soft delete (the row survives to become a tombstone in sync), so access only really
   * goes away if every permission reader discards the deleted row.
   */
  it('stops a former collaborator from exporting it', async () => {
    await grant(ana.token, bia.userId, 'reader');
    await revoke(ana.token, bia.userId);

    const { status } = await request('GET', `/stories/${storyId}/export`, { token: bia.token });

    expect(status).toBe(404);
  });

  it('stops a former collaborator from pulling it', async () => {
    await grant(ana.token, bia.userId, 'writer');
    await revoke(ana.token, bia.userId);

    const { status } = await pull(bia.token);

    expect(status).toBe(403);
  });

  it('stops a former collaborator from pushing to it', async () => {
    await grant(ana.token, bia.userId, 'writer');
    await revoke(ana.token, bia.userId);
    const characterId = newId();

    const { status, data } = await request('POST', `/sync/${storyId}`, {
      token: bia.token,
      body: [
        {
          type: 'create',
          entity: 'Character',
          id: characterId,
          data: { id: characterId, storyId, name: 'Nyx' },
        },
      ],
    });

    expect(status === 403 || data?.applied?.length === 0).toBe(true);
  });

  it('restores access when the owner shares the story again', async () => {
    await grant(ana.token, bia.userId, 'reader');
    await revoke(ana.token, bia.userId);
    await grant(ana.token, bia.userId, 'reader');

    const { status } = await request('GET', `/stories/${storyId}/export`, { token: bia.token });

    expect(status).toBe(200);
  });

  it('lets a writer push a change', async () => {
    await grant(ana.token, bia.userId, 'writer');
    const characterId = newId();

    const { data } = await request('POST', `/sync/${storyId}`, {
      token: bia.token,
      body: [
        {
          type: 'create',
          entity: 'Character',
          id: characterId,
          data: { id: characterId, storyId, name: 'Nyx' },
        },
      ],
    });

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
  });

  it('refuses a write from a reader', async () => {
    await grant(ana.token, bia.userId, 'reader');
    const characterId = newId();

    const { status, data } = await request('POST', `/sync/${storyId}`, {
      token: bia.token,
      body: [
        {
          type: 'create',
          entity: 'Character',
          id: characterId,
          data: { id: characterId, storyId, name: 'Nyx' },
        },
      ],
    });

    if (status === 200) {
      expect(data.applied).toEqual([]);
      expect(data.conflicts).toHaveLength(1);
      expect(data.conflicts[0].reason).toBe('unauthorized');
    } else {
      expect(status).toBeGreaterThanOrEqual(400);
    }
  });
});
