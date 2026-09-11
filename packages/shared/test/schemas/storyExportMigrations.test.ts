import { describe, expect, it } from 'vitest';
import { CURRENT_STORY_FORMAT_VERSION } from '../../schemas/StoryExportVersion';
import { migrateStoryExport, StoryExportVersionError } from '../../schemas/storyExportMigrations';

/** The collections the V4 -> V5 migration materialises as empty. */
const EMPTY_V5_COLLECTIONS = { stats: [], statStrengths: [], statRelations: [], modes: [] };
const EMPTY_V6_COLLECTIONS = { plots: [], plotScenes: [] };
/** V6 -> V7 materialises the story's chronology, which no earlier package could have stated. */
const EMPTY_V7_COLLECTIONS = { chapterAnchors: [] };
/** V7 -> V8 materialises the story's own calendars, for the same reason. */
const EMPTY_V8_COLLECTIONS = { storyCalendars: [] };
/** V8 -> V9 materialises authored routes, which older packages could not express. */
const EMPTY_V9_COLLECTIONS = { routes: [], routeSteps: [] };
const defaultArc = (storyId: string) => [
  {
    id: `arc:${storyId}:default`,
    storyId,
    title: 'Arc',
    description: null,
    sortOrder: 0,
    color: null,
    icon: null,
    themeOverride: null,
    isDefault: true,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  },
];

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
      story: { ...v2Export.story, statSystem: false, statNotation: 'letter', vocabulary: null },
      comments: [],
      seeAlsoRelations: [],
      choiceCheckGroups: [],
      choiceChecks: [],
      effects: [],
      ...EMPTY_V5_COLLECTIONS,
      ...EMPTY_V6_COLLECTIONS,
      ...EMPTY_V7_COLLECTIONS,
      ...EMPTY_V8_COLLECTIONS,
      ...EMPTY_V9_COLLECTIONS,
      storyArcs: defaultArc('story-2'),
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
      story: { ...v3Export.story, statSystem: false, statNotation: 'letter', vocabulary: null },
      choiceCheckGroups: [],
      choiceChecks: [],
      effects: [],
      ...EMPTY_V5_COLLECTIONS,
      ...EMPTY_V6_COLLECTIONS,
      ...EMPTY_V7_COLLECTIONS,
      ...EMPTY_V8_COLLECTIONS,
      ...EMPTY_V9_COLLECTIONS,
      storyArcs: defaultArc('story-3b'),
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
      story: { ...v4Export.story, statSystem: false, statNotation: 'letter', vocabulary: null },
      ...EMPTY_V5_COLLECTIONS,
      ...EMPTY_V6_COLLECTIONS,
      ...EMPTY_V7_COLLECTIONS,
      ...EMPTY_V8_COLLECTIONS,
      ...EMPTY_V9_COLLECTIONS,
      storyArcs: defaultArc('story-4'),
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
    });
  });

  it('migrates a V8 export with vocabulary and authored route collections together', () => {
    const v8Export = {
      formatVersion: 8,
      story: {
        id: 'story-8',
        title: 'Current story',
        favoriteBehavior: 'individual',
        normalizeSceneTiming: false,
        statSystem: false,
        statNotation: 'letter',
      },
      storyCalendars: [{ id: 'calendar-1' }],
    };

    expect(migrateStoryExport(v8Export)).toEqual({
      ...v8Export,
      story: { ...v8Export.story, vocabulary: null },
      ...EMPTY_V9_COLLECTIONS,
      storyArcs: defaultArc('story-8'),
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
    });
  });

  it('migrates a V9 package to one default Arc and assigns its unassigned containers', () => {
    const v9Export = {
      formatVersion: 9,
      story: {
        id: 'story-9',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
      },
      chapters: [
        { id: 'chapter-9', storyId: 'story-9', arcId: null },
        { id: 'event-9', storyId: 'story-9' },
      ],
    };

    const migrated = migrateStoryExport(v9Export);

    expect(migrated).toMatchObject({
      formatVersion: 10,
      storyArcs: [
        {
          ...defaultArc('story-9')[0],
          createdAt: v9Export.story.createdAt,
          updatedAt: v9Export.story.updatedAt,
        },
      ],
      chapters: [
        { id: 'chapter-9', arcId: 'arc:story-9:default' },
        { id: 'event-9', arcId: 'arc:story-9:default' },
      ],
    });
    expect(v9Export.chapters).toEqual([
      { id: 'chapter-9', storyId: 'story-9', arcId: null },
      { id: 'event-9', storyId: 'story-9' },
    ]);
  });

  it('rejects an export produced by a newer format', () => {
    expect(() => migrateStoryExport({ formatVersion: CURRENT_STORY_FORMAT_VERSION + 1 })).toThrow(
      StoryExportVersionError,
    );
  });
});
