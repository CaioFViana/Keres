import { describe, expect, it } from 'vitest';
import { CURRENT_STORY_FORMAT_VERSION } from '../../schemas/StoryExportVersion';
import { migrateStoryExport, StoryExportVersionError } from '../../schemas/storyExportMigrations';

describe('migrateStoryExport', () => {
  it('migrates a V1 export to the current format without changing the source object', () => {
    const v1Export = {
      formatVersion: 1,
      story: { id: 'story-1', title: 'Legacy story' },
      suggestions: [{ id: 'suggestion-1', storyId: 'story-1', type: 'item_state', value: 'New', isDefault: true }],
    };

    const migrated = migrateStoryExport(v1Export);

    expect(migrated).toMatchObject({
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
      story: {
        id: 'story-1',
        favoriteBehavior: 'global',
        normalizeSceneTiming: false,
      },
      favorites: [],
      comments: [],
      seeAlsoRelations: [],
    });
    expect(migrated.suggestions).toEqual([
      { id: 'suggestion-1', storyId: 'story-1', type: 'item_state', value: 'New' },
    ]);
    expect(v1Export.suggestions[0].isDefault).toBe(true);
  });

  it('migrates a V2 export with empty V3 relation collections', () => {
    const v2Export = {
      formatVersion: 2,
      story: { id: 'story-2', title: 'Current story', favoriteBehavior: 'individual_public', normalizeSceneTiming: true },
      suggestions: [],
      favorites: [{ id: 'favorite-1' }],
    };

    expect(migrateStoryExport(v2Export)).toEqual({
      ...v2Export,
      comments: [],
      seeAlsoRelations: [],
      choiceCheckGroups: [],
      choiceChecks: [],
      effects: [],
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
    });
  });

  it('migrates a V3 export with empty V4 check/effect collections', () => {
    const v3Export = {
      formatVersion: 3,
      story: { id: 'story-3b', title: 'Current story', favoriteBehavior: 'individual', normalizeSceneTiming: false },
      comments: [{ id: 'comment-1' }],
      seeAlsoRelations: [{ id: 'relation-1' }],
    };

    expect(migrateStoryExport(v3Export)).toEqual({
      ...v3Export,
      choiceCheckGroups: [],
      choiceChecks: [],
      effects: [],
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
    });
  });

  it('preserves comments and see-also relations already present in V3', () => {
    const v3Export = {
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
      story: { id: 'story-3', title: 'Current story', favoriteBehavior: 'individual', normalizeSceneTiming: false },
      comments: [{ id: 'comment-1' }],
      seeAlsoRelations: [{ id: 'relation-1' }],
    };

    expect(migrateStoryExport(v3Export)).toEqual(v3Export);
  });

  it('rejects an export produced by a newer format', () => {
    expect(() => migrateStoryExport({ formatVersion: CURRENT_STORY_FORMAT_VERSION + 1 }))
      .toThrow(StoryExportVersionError);
  });
});
