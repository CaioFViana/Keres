import { describe, expect, it } from 'vitest';
import { CURRENT_STORY_FORMAT_VERSION } from './StoryExportVersion';
import { migrateStoryExport, StoryExportVersionError } from './storyExportMigrations';

describe('migrateStoryExport', () => {
  it('migrates a V1 export to V2 without changing the source object', () => {
    const v1Export = {
      formatVersion: 1,
      story: { id: 'story-1', title: 'Legacy story' },
      suggestions: [{ id: 'suggestion-1', storyId: 'story-1', type: 'item_state', value: 'New', isDefault: true }],
    };

    const migrated = migrateStoryExport(v1Export);

    expect(migrated).toMatchObject({
      formatVersion: 2,
      story: {
        id: 'story-1',
        favoriteBehavior: 'global',
        normalizeSceneTiming: false,
      },
      favorites: [],
    });
    expect(migrated.suggestions).toEqual([
      { id: 'suggestion-1', storyId: 'story-1', type: 'item_state', value: 'New' },
    ]);
    expect(v1Export.suggestions[0].isDefault).toBe(true);
  });

  it('preserves V2 data that already uses the new fields', () => {
    const v2Export = {
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
      story: { id: 'story-2', title: 'Current story', favoriteBehavior: 'individual_public', normalizeSceneTiming: true },
      suggestions: [],
      favorites: [{ id: 'favorite-1' }],
    };

    expect(migrateStoryExport(v2Export)).toEqual(v2Export);
  });

  it('rejects an export produced by a newer format', () => {
    expect(() => migrateStoryExport({ formatVersion: CURRENT_STORY_FORMAT_VERSION + 1 }))
      .toThrow(StoryExportVersionError);
  });
});
