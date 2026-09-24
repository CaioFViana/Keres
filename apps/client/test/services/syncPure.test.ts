/**
 * @jest-environment node
 */
import type { CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { protectRemoteUpdate } from '../../src/services/sync/syncPure';

describe('protectRemoteUpdate', () => {
  it('drops unknown keys from an update so a newer server field cannot stall the pull', () => {
    const update = {
      type: 'update',
      entity: 'Character',
      id: 'character-1',
      changes: {
        name: 'Server name',
        version: 7,
        someFutureField: 'from a newer server',
      },
    } as UpdateStoryUpdate;

    const result = protectRemoteUpdate(update) as UpdateStoryUpdate;

    expect(result.changes).toEqual({ name: 'Server name', version: 7 });
  });

  it('drops unknown keys from a create while keeping every real column', () => {
    const update = {
      type: 'create',
      entity: 'Character',
      id: 'character-1',
      data: {
        name: 'Server name',
        version: 1,
        updatedAt: '2026-09-24T00:00:00.000Z',
        someFutureField: 'from a newer server',
      },
    } as unknown as CreateStoryUpdate;

    const result = protectRemoteUpdate(update) as CreateStoryUpdate;

    expect(result.data).toEqual({
      name: 'Server name',
      version: 1,
      updatedAt: new Date('2026-09-24T00:00:00.000Z'),
    });
  });

  it('still strips local bookkeeping columns', () => {
    const update = {
      type: 'update',
      entity: 'Story',
      id: 'story-1',
      changes: { title: 'Server title', version: 3, myRole: 'owner', userId: 'someone-else' },
    } as unknown as UpdateStoryUpdate;

    const result = protectRemoteUpdate(update) as UpdateStoryUpdate;

    expect(result.changes).toEqual({ title: 'Server title', version: 3 });
  });

  it('passes deletes and reorders through untouched', () => {
    const del = { type: 'delete', entity: 'Character', id: 'character-1' } as never;
    const reorder = {
      type: 'reorder',
      entity: 'Chapter',
      id: 'chapter-1',
      reorderItems: [{ id: 'scene-1', newIndex: 1 }],
    } as never;

    expect(protectRemoteUpdate(del)).toBe(del);
    expect(protectRemoteUpdate(reorder)).toBe(reorder);
  });
});
