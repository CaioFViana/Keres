import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { db } from '../../src/db';
import {
  closeRealtimeEvents,
  createWebSocketTicket,
  openRealtimeEvents,
} from '../../src/modules/webSocket/webSocket.route';
import type { RealtimeSocket } from '../../src/services/RealtimeSessionService';
import { storyPermissions } from '../../src/db/schema';
import {
  newId,
  registerUser,
  request,
  shareStory,
  type TestUser,
  uploadTestStory,
} from '../helpers/app';
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
  storyId = (await uploadTestStory(ana.token)).id;
});

describe('POST /story-permissions/', () => {
  it('never gives access to a friend who was not invited', async () => {
    const { status, data } = await grant(ana.token, bia.userId, 'writer');

    expect(status).toBe(409);
    expect(data.message).toMatch(/invite them/);
    expect((await listFor(ana.token)).data).toEqual([]);
  });

  it('lists a collaborator once they accept the invitation', async () => {
    await shareStory(ana, bia, storyId, 'reader');

    const { data } = await listFor(ana.token);
    expect(data.some((permission: any) => permission.userId === bia.userId)).toBe(true);
  });

  it('makes the story reachable for the person it was shared with', async () => {
    const before = await request('GET', '/sync/pullpreviews', { token: bia.token });
    expect(before.data.storyPreviews).toEqual([]);

    await shareStory(ana, bia, storyId, 'reader');

    const after = await request('GET', '/sync/pullpreviews', { token: bia.token });
    expect(after.data.storyPreviews).toEqual([
      expect.objectContaining({ storyId, role: 'reader' }),
    ]);
  });

  it('still reports the owner as owner when a stale permission row names them', async () => {
    // The grant endpoint refuses the owner, so this row can only exist from legacy data or a
    // manual insert - but if it does, it must not downgrade the owner's role.
    await db.insert(storyPermissions).values({
      id: newId(),
      storyId,
      userId: ana.userId,
      permissionType: 'reader',
    });

    const { data } = await request('GET', '/sync/pullpreviews', { token: ana.token });

    expect(data.storyPreviews).toEqual([expect.objectContaining({ storyId, role: 'owner' })]);
  });

  it.each(['reader', 'writer'])(
    'reports the granted %s role back to the collaborator',
    async (permissionType) => {
      await shareStory(ana, bia, storyId, permissionType as 'reader' | 'writer');

      const { data } = await pull(bia.token);

      expect(data.role).toBe(permissionType);
    },
  );

  it('updates an existing grant instead of duplicating it', async () => {
    await shareStory(ana, bia, storyId, 'reader');
    const changed = await grant(ana.token, bia.userId, 'writer');
    expect(changed.status).toBe(200);

    const { data } = await listFor(ana.token);

    expect(data.filter((permission: any) => permission.userId === bia.userId)).toHaveLength(1);
    expect((await pull(bia.token)).data.role).toBe('writer');
  });

  it('refuses to let a collaborator share the story onward', async () => {
    await shareStory(ana, bia, storyId, 'writer');
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
    const outra = await uploadTestStory(bia.token, 'Outra');

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
    await shareStory(ana, bia, storyId, 'reader');

    const { status } = await revoke(ana.token, bia.userId);

    expect(status).toBe(200);
    const { data } = await request('GET', '/sync/pullpreviews', { token: bia.token });
    expect(data.storyPreviews).toEqual([]);
    expect((await listFor(ana.token)).data).toEqual([]);
  });

  it('refuses a revoke from someone who does not own the story', async () => {
    await shareStory(ana, bia, storyId, 'writer');

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

describe('DELETE /story-permissions/story/:storyId/me', () => {
  const leave = (token: string, story = storyId) =>
    request('DELETE', `/story-permissions/story/${story}/me`, { token });

  it('lets a collaborator give up their own access: the story leaves their catalog and the owner list', async () => {
    await shareStory(ana, bia, storyId, 'writer');

    const { status } = await leave(bia.token);

    expect(status).toBe(200);
    const { data } = await request('GET', '/sync/pullpreviews', { token: bia.token });
    expect(data.storyPreviews).toEqual([]);
    expect((await listFor(ana.token)).data).toEqual([]);
    expect((await pull(bia.token)).status).toBe(403);
    expect((await request('GET', `/stories/${storyId}/export`, { token: bia.token })).status).toBe(
      404,
    );
  });

  it('keeps the row as a tombstone, so sync can carry the loss of access', async () => {
    await shareStory(ana, bia, storyId, 'reader');

    await leave(bia.token);

    const [row] = await db.select().from(storyPermissions);
    expect(row.isDeleted).toBe(true);
    expect(row.version).toBeGreaterThan(1);
  });

  it('can be undone by the owner inviting again', async () => {
    await shareStory(ana, bia, storyId, 'reader');
    await leave(bia.token);
    await shareStory(ana, bia, storyId, 'writer');

    expect((await request('GET', `/stories/${storyId}/export`, { token: bia.token })).status).toBe(
      200,
    );
    expect((await listFor(ana.token)).data).toHaveLength(1);
  });

  it('refuses the owner: the story is theirs, and ending it is deleting it', async () => {
    const { status, data } = await leave(ana.token);

    expect(status).toBe(400);
    expect(data.message).toMatch(/owner cannot leave/i);
  });

  it('answers 404 to somebody who never collaborated, or already left', async () => {
    expect((await leave(bia.token)).status).toBe(404);

    await shareStory(ana, bia, storyId, 'reader');
    await leave(bia.token);
    expect((await leave(bia.token)).status).toBe(404);
  });

  it('requires a session', async () => {
    const { status } = await request('DELETE', `/story-permissions/story/${storyId}/me`);

    expect(status).toBe(401);
  });
});

describe('GET /story-permissions/story/:storyId', () => {
  it('starts empty for a story that was never shared', async () => {
    const { status, data } = await listFor(ana.token);

    expect(status).toBe(200);
    expect(data).toEqual([]);
  });

  it('refuses to show the collaborator list to a collaborator', async () => {
    await shareStory(ana, bia, storyId, 'writer');

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
    await shareStory(ana, bia, storyId, 'reader');

    const { status } = await request('GET', `/stories/${storyId}/export`, { token: bia.token });

    expect(status).toBe(200);
  });

  /**
   * Revocation is a soft delete (the row survives to become a tombstone in sync), so access only really
   * goes away if every permission reader discards the deleted row.
   */
  it('stops a former collaborator from exporting it', async () => {
    await shareStory(ana, bia, storyId, 'reader');
    await revoke(ana.token, bia.userId);

    const { status } = await request('GET', `/stories/${storyId}/export`, { token: bia.token });

    expect(status).toBe(404);
  });

  it('stops a former collaborator from pulling it', async () => {
    await shareStory(ana, bia, storyId, 'writer');
    await revoke(ana.token, bia.userId);

    const { status } = await pull(bia.token);

    expect(status).toBe(403);
  });

  it('stops a former collaborator from pushing to it', async () => {
    await shareStory(ana, bia, storyId, 'writer');
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
    await shareStory(ana, bia, storyId, 'reader');
    await revoke(ana.token, bia.userId);
    await shareStory(ana, bia, storyId, 'reader');

    const { status } = await request('GET', `/stories/${storyId}/export`, { token: bia.token });

    expect(status).toBe(200);
  });

  it('lets a writer push a change', async () => {
    await shareStory(ana, bia, storyId, 'writer');
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
    await shareStory(ana, bia, storyId, 'reader');
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

/**
 * Every change to who collaborates on a story is something the people involved have to see without asking:
 * the collaborator's copy has to go, and the owner's list - on every device - has to change.
 */
describe('realtime notifications of collaboration changes', () => {
  type Socket = RealtimeSocket & { send: Mock; close: Mock };
  const sockets: Socket[] = [];
  const connect = async (user: TestUser): Promise<Socket> => {
    const socket = { send: vi.fn(), close: vi.fn() } as unknown as Socket;
    sockets.push(socket);
    await openRealtimeEvents(
      socket,
      createWebSocketTicket({ userId: user.userId, username: user.username }),
    );
    return socket;
  };
  const events = (socket: Socket) =>
    socket.send.mock.calls.map(
      ([message]) => JSON.parse(String(message)) as { type: string; storyId?: string },
    );
  const heard = (socket: Socket, type: string) =>
    events(socket).filter((event) => event.type === type);

  afterEach(() => {
    while (sockets.length) closeRealtimeEvents(sockets.pop()!);
  });

  it('tells the owner, on every device, when a collaborator leaves - and the collaborator to drop the story', async () => {
    await shareStory(ana, bia, storyId, 'writer');
    const owner = await connect(ana);
    const ownerOtherDevice = await connect(ana);
    const collaborator = await connect(bia);

    await request('DELETE', `/story-permissions/story/${storyId}/me`, { token: bia.token });

    for (const device of [owner, ownerOtherDevice]) {
      expect(heard(device, 'story.collaborators-changed')).toEqual([
        { type: 'story.collaborators-changed', storyId },
      ]);
    }
    expect(heard(collaborator, 'stories.catalog-changed')).toHaveLength(1);
  });

  it("tells the collaborator to drop the story when the owner removes them, and the owner's other devices", async () => {
    await shareStory(ana, bia, storyId, 'reader');
    const owner = await connect(ana);
    const collaborator = await connect(bia);

    await revoke(ana.token, bia.userId);

    expect(heard(collaborator, 'stories.catalog-changed')).toHaveLength(1);
    expect(heard(owner, 'story.collaborators-changed')).toHaveLength(1);
  });

  it('tells both sides when a role changes', async () => {
    await shareStory(ana, bia, storyId, 'reader');
    const owner = await connect(ana);
    const collaborator = await connect(bia);

    await grant(ana.token, bia.userId, 'writer');

    expect(heard(collaborator, 'stories.catalog-changed')).toHaveLength(1);
    expect(heard(owner, 'story.collaborators-changed')).toHaveLength(1);
  });

  it('tells the owner when an invitation is accepted', async () => {
    const owner = await connect(ana);

    await shareStory(ana, bia, storyId, 'reader');

    expect(heard(owner, 'story.collaborators-changed')).toEqual([
      { type: 'story.collaborators-changed', storyId },
    ]);
  });

  it('tells both sides when the end of a friendship takes the access with it', async () => {
    await shareStory(ana, bia, storyId, 'writer');
    const owner = await connect(ana);
    const collaborator = await connect(bia);

    await request('DELETE', `/friend/unfriend/${ana.userId}`, { token: bia.token });

    expect(heard(collaborator, 'stories.catalog-changed').length).toBeGreaterThanOrEqual(1);
    expect(heard(owner, 'story.collaborators-changed')).toEqual([
      { type: 'story.collaborators-changed', storyId },
    ]);
  });

  it('says nothing to anybody when the owner tries to leave, or a stranger does', async () => {
    const owner = await connect(ana);
    const stranger = await connect(bia);

    await request('DELETE', `/story-permissions/story/${storyId}/me`, { token: ana.token });
    await request('DELETE', `/story-permissions/story/${storyId}/me`, { token: bia.token });

    expect(heard(owner, 'story.collaborators-changed')).toEqual([]);
    expect(heard(stranger, 'stories.catalog-changed')).toEqual([]);
  });
});
