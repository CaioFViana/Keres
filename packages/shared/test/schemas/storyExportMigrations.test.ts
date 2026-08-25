import { describe, expect, it } from 'vitest';
import { CURRENT_STORY_FORMAT_VERSION } from '../../schemas/StoryExportVersion';
import { migrateStoryExport, StoryExportVersionError } from '../../schemas/storyExportMigrations';

/** The collections the V4 -> V5 migration materialises as empty. */
const EMPTY_V5_COLLECTIONS = { stats: [], statStrengths: [], statRelations: [], modes: [] };
const EMPTY_V6_COLLECTIONS = { plots: [], plotScenes: [] };

describe('migrateStoryExport', () => {
  it('migrates a V1 export to the current format without changing the source object', () => {
    const v1Export = {
      formatVersion: 1,
      story: { id: 'story-1', title: 'Legacy story' },
      suggestions: [
        {
          id: 'suggestion-1',
          storyId: 'story-1',
          type: 'item_state',
          value: 'New',
          isDefault: true,
        },
      ],
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
      story: {
        id: 'story-2',
        title: 'Current story',
        favoriteBehavior: 'individual_public',
        normalizeSceneTiming: true,
      },
      suggestions: [],
      favorites: [{ id: 'favorite-1' }],
    };

    expect(migrateStoryExport(v2Export)).toEqual({
      ...v2Export,
      story: { ...v2Export.story, statSystem: false, statNotation: 'letter' },
      comments: [],
      seeAlsoRelations: [],
      choiceCheckGroups: [],
      choiceChecks: [],
      effects: [],
      ...EMPTY_V5_COLLECTIONS,
      ...EMPTY_V6_COLLECTIONS,
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
    });
  });

  it('migrates a V3 export with empty V4 check/effect collections', () => {
    const v3Export = {
      formatVersion: 3,
      story: {
        id: 'story-3b',
        title: 'Current story',
        favoriteBehavior: 'individual',
        normalizeSceneTiming: false,
      },
      comments: [{ id: 'comment-1' }],
      seeAlsoRelations: [{ id: 'relation-1' }],
    };

    expect(migrateStoryExport(v3Export)).toEqual({
      ...v3Export,
      story: { ...v3Export.story, statSystem: false, statNotation: 'letter' },
      choiceCheckGroups: [],
      choiceChecks: [],
      effects: [],
      ...EMPTY_V5_COLLECTIONS,
      ...EMPTY_V6_COLLECTIONS,
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
    });
  });

  it('leaves a package already in the current format untouched', () => {
    const currentExport = {
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
      story: {
        id: 'story-3',
        title: 'Current story',
        favoriteBehavior: 'individual',
        normalizeSceneTiming: false,
        statSystem: true,
        statNotation: 'number',
      },
      comments: [{ id: 'comment-1' }],
      seeAlsoRelations: [{ id: 'relation-1' }],
      stats: [{ id: 'stat-1' }],
      statStrengths: [{ id: 'strength-1' }],
      statRelations: [{ id: 'value-1' }],
      modes: [{ id: 'mode-1' }],
    };

    expect(migrateStoryExport(currentExport)).toEqual(currentExport);
  });

  it('migrates a V4 export with the stat system off and empty stat collections', () => {
    const v4Export = {
      formatVersion: 4,
      story: {
        id: 'story-4',
        title: 'Current story',
        favoriteBehavior: 'individual',
        normalizeSceneTiming: false,
      },
      choiceCheckGroups: [{ id: 'group-1' }],
      choiceChecks: [],
      effects: [],
    };

    expect(migrateStoryExport(v4Export)).toEqual({
      ...v4Export,
      story: { ...v4Export.story, statSystem: false, statNotation: 'letter' },
      ...EMPTY_V5_COLLECTIONS,
      ...EMPTY_V6_COLLECTIONS,
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
    });
  });

  it('rejects an export produced by a newer format', () => {
    expect(() => migrateStoryExport({ formatVersion: CURRENT_STORY_FORMAT_VERSION + 1 })).toThrow(
      StoryExportVersionError,
    );
  });
});
