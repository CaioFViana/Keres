import { encodeSketchItems, type SketchItem } from '@keres/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { SketchSyncHandler } from '../../src/services/entity-sync-handlers/SketchSyncHandler';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let user: TestUser;
let storyId: string;

const push = (updates: unknown[]) =>
  request('POST', `/sync/${storyId}`, { token: user.token, body: updates });

describe('sketches through the sync endpoint', () => {
  beforeEach(async () => {
    await truncateAll();
    user = await registerUser('sketch-user');
    storyId = (await uploadTestStory(user.token, 'Sketch sync')).id;
  });

  it('registers the Sketch protocol entity', () => {
    expect(new SketchSyncHandler().entityName).toBe('Sketch');
  });

  it('accepts a creation followed by an edit of the same sketch', async () => {
    const sketchId = newId();
    const create = {
      type: 'create' as const,
      entity: 'Sketch',
      id: sketchId,
      version: 0,
      clientOperationId: 'sketch-create',
      data: {
        name: 'Throne room',
        description: null,
        content: {
          page: { width: 794, height: 1123, preset: 'a4' },
          layers: [
            { id: 'ABCDEFGH', name: 'Layer 1', visible: true, opacity: 1, locked: false, data: '' },
          ],
          overlays: [],
        },
        coverGalleryId: null,
      },
    };
    const update = {
      type: 'update' as const,
      entity: 'Sketch',
      id: sketchId,
      version: 1,
      clientOperationId: 'sketch-update',
      changes: {
        version: 1,
        content: {
          page: { width: 1080, height: 1080, preset: 'square' },
          layers: [
            { id: 'ABCDEFGH', name: 'Ink', visible: true, opacity: 1, locked: false, data: '' },
          ],
          overlays: [],
        },
      },
    };

    const created = await push([create]);
    expect(created.status).toBe(200);
    expect(created.data.conflicts).toEqual([]);

    // Retrying the exact create must still match by value instead of reporting
    // an ID collision against the drawing already stored.
    const retriedUnchangedCreate = await push([create]);
    expect(retriedUnchangedCreate.status).toBe(200);
    expect(retriedUnchangedCreate.data.conflicts).toEqual([]);

    const edited = await push([update]);
    expect(edited.status).toBe(200);
    expect(edited.data.conflicts).toEqual([]);
    expect(edited.data.applied).toEqual([
      expect.objectContaining({ clientOperationId: 'sketch-update', entityVersion: 2 }),
    ]);

    // Once the edit has landed, retrying the original create must acknowledge that
    // old operation instead of comparing its initial page with the newer sketch.
    const retriedCreate = await push([create]);
    expect(retriedCreate.status).toBe(200);
    expect(retriedCreate.data.conflicts).toEqual([]);
    expect(retriedCreate.data.applied).toEqual([
      expect.objectContaining({ clientOperationId: 'sketch-create', entityVersion: 2 }),
    ]);
  });

  const drawing: SketchItem[] = [
    {
      kind: 'stroke',
      brush: 'pen',
      color: '#112233',
      alpha: 1,
      size: 3,
      points: [0, 0, 40, 20, 80, 0],
    },
  ];
  const sketchWith = (data: string) => ({
    name: 'Drawn',
    description: null,
    content: {
      page: { width: 794, height: 1123, preset: 'a4', background: 'paper' },
      layers: [{ id: 'ABCDEFGH', name: 'Layer 1', visible: true, opacity: 1, locked: false, data }],
      overlays: [],
    },
    coverGalleryId: null,
  });

  it('accepts a sketch carrying real drawing data', async () => {
    const response = await push([
      {
        type: 'create',
        entity: 'Sketch',
        id: newId(),
        version: 0,
        clientOperationId: 'sketch-drawn',
        data: sketchWith(encodeSketchItems(drawing)),
      },
    ]);
    expect(response.status).toBe(200);
    expect(response.data.conflicts).toEqual([]);
    expect(response.data.applied).toEqual([
      expect.objectContaining({ clientOperationId: 'sketch-drawn' }),
    ]);
  });

  it('does not apply a sketch whose drawing data is corrupt', async () => {
    const response = await push([
      {
        type: 'create',
        entity: 'Sketch',
        id: newId(),
        version: 0,
        clientOperationId: 'sketch-corrupt',
        data: sketchWith('AAAAAAAA'),
      },
    ]);
    expect(response.data.applied ?? []).toEqual([]);
  });
});
