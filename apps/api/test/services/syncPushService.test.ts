import { describe, expect, it } from 'vitest';
import { SyncOperationLogService } from '../../src/services/sync/SyncOperationLogService';
import {
  resetCompactionThrottle,
  shouldCompactStoryNow,
  storyUpdateFlipsFavorites,
} from '../../src/services/sync/pushPolicy';

describe('shouldCompactStoryNow', () => {
  it('runs at most once per story per hour', () => {
    resetCompactionThrottle();
    const story = 'story-1';

    expect(shouldCompactStoryNow(story, 0)).toBe(true);
    expect(shouldCompactStoryNow(story, 1)).toBe(false);
    expect(shouldCompactStoryNow(story, 60 * 60 * 1000 - 1)).toBe(false);
    expect(shouldCompactStoryNow(story, 60 * 60 * 1000)).toBe(true);
  });

  it('throttles stories independently', () => {
    resetCompactionThrottle();

    expect(shouldCompactStoryNow('story-1', 0)).toBe(true);
    expect(shouldCompactStoryNow('story-2', 0)).toBe(true);
    expect(shouldCompactStoryNow('story-1', 1)).toBe(false);
    expect(shouldCompactStoryNow('story-2', 1)).toBe(false);
  });
});

describe('storyUpdateFlipsFavorites', () => {
  it('matches only a Story update carrying favoriteBehavior', () => {
    expect(
      storyUpdateFlipsFavorites({
        type: 'update',
        entity: 'Story',
        id: 'story-1',
        changes: { favoriteBehavior: 'individual_public', version: 2 },
      } as never),
    ).toBe(true);
    expect(
      storyUpdateFlipsFavorites({
        type: 'update',
        entity: 'Story',
        id: 'story-1',
        changes: { title: 'New title', version: 2 },
      } as never),
    ).toBe(false);
    expect(
      storyUpdateFlipsFavorites({
        type: 'reorder',
        entity: 'Story',
        id: 'story-1',
        version: 2,
        reorderItems: [],
      } as never),
    ).toBe(false);
    expect(
      storyUpdateFlipsFavorites({
        type: 'create',
        entity: 'Story',
        id: 'story-1',
        data: { favoriteBehavior: 'individual_public' },
      } as never),
    ).toBe(false);
    expect(
      storyUpdateFlipsFavorites({
        type: 'update',
        entity: 'Character',
        id: 'character-1',
        changes: { name: 'Nyx', version: 2 },
      } as never),
    ).toBe(false);
  });
});

describe('SyncOperationLogService.append', () => {
  it('refuses an operation log without an entity id instead of inventing one', async () => {
    const service = new SyncOperationLogService(new Map());

    await expect(
      service.append({
        storyId: 'story-1',
        userId: 'user-1',
        update: { type: 'update', entity: 'Character', id: 'character-1' } as never,
        entityId: '',
      }),
    ).rejects.toThrow('without an entity id');
  });
});
