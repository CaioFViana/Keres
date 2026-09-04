import { beforeEach, describe, expect, it } from 'vitest';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let user: TestUser;
let storyId: string;

const push = (updates: unknown[]) =>
  request('POST', `/sync/${storyId}`, { token: user.token, body: updates });

describe('boards through the sync endpoint', () => {
  beforeEach(async () => {
    await truncateAll();
    user = await registerUser('board-user');
    storyId = (await uploadTestStory(user.token, 'Board sync')).id;
  });

  it('accepts a creation followed by an edit of the same board', async () => {
    const boardId = newId();
    const create = {
      type: 'create' as const,
      entity: 'Board',
      id: boardId,
      version: 0,
      clientOperationId: 'board-create',
      data: {
        name: 'Family tree',
        description: null,
        content: { nodes: [], edges: [] },
      },
    };
    const update = {
      type: 'update' as const,
      entity: 'Board',
      id: boardId,
      version: 1,
      clientOperationId: 'board-update',
      changes: {
        version: 1,
        content: {
          nodes: [
            {
              id: '01ABCDEF',
              kind: 'note',
              x: 10,
              y: 20,
              title: 'Theme',
              body: null,
            },
          ],
          edges: [],
        },
      },
    };

    const created = await push([create]);
    expect(created.status).toBe(200);
    expect(created.data.conflicts).toEqual([]);

    // PostgreSQL stores the drawing as JSONB and may reorder object keys. Retrying this exact
    // create must still match by JSON value, rather than treating `{ nodes, edges }` as different
    // from the same object read back in another key order.
    const retriedUnchangedCreate = await push([create]);
    expect(retriedUnchangedCreate.status).toBe(200);
    expect(retriedUnchangedCreate.data.conflicts).toEqual([]);

    const edited = await push([update]);
    expect(edited.status).toBe(200);
    expect(edited.data.conflicts).toEqual([]);
    expect(edited.data.applied).toEqual([
      expect.objectContaining({ clientOperationId: 'board-update', entityVersion: 2 }),
    ]);

    // A response can be lost or delayed. Once the edit has landed, retrying the original
    // create must acknowledge that old operation instead of comparing its initial drawing with
    // the newer board and reporting a false ID collision.
    const retriedCreate = await push([create]);
    expect(retriedCreate.status).toBe(200);
    expect(retriedCreate.data.conflicts).toEqual([]);
    expect(retriedCreate.data.applied).toEqual([
      // It acknowledges the original creation through the server log, while reporting the
      // entity's current version to a client that may need to rebase later edits.
      expect.objectContaining({ clientOperationId: 'board-create', entityVersion: 2 }),
    ]);
  });
});
