import { describe, expect, it } from 'vitest';
import { CURRENT_STORY_FORMAT_VERSION } from '../../../schemas/story/StoryExportVersion';
import {
  migrateStoryExport,
  StoryExportVersionError,
} from '../../../schemas/story/storyExportMigrations';

/** The collections the V4 -> V5 migration materialises as empty. */
const EMPTY_V5_COLLECTIONS = { stats: [], statStrengths: [], statRelations: [], modes: [] };
const EMPTY_V6_COLLECTIONS = { plots: [], plotScenes: [] };
/** V6 -> V7 materialises the story's chronology, which no earlier package could have stated. */
const EMPTY_V7_COLLECTIONS = { chapterAnchors: [] };
/** V7 -> V8 materialises the story's own calendars, for the same reason. */
const EMPTY_V8_COLLECTIONS = { storyCalendars: [] };
/** V8 -> V9 materialises authored routes, which older packages could not express. */
const EMPTY_V9_COLLECTIONS = { routes: [], routeSteps: [] };
/** V11 -> V12 materialises what a story had before 1.10: nothing of these, a story that is not adult, no cover. */
const V12_STORY = { isNsfw: false, coverGalleryId: null };
/** V11 -> V12 materialises songs, sketches and the pages and music of a scene. */
const EMPTY_V12_COLLECTIONS = { songs: [], storySketches: [], scenePages: [], sceneMusic: [] };
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
    medium: 'generic',
    vocabulary: null,
    author: null,
    coverGalleryId: null,
    pageFormat: null,
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
      story: {
        ...v2Export.story,
        ...V12_STORY,
        statSystem: false,
        statNotation: 'letter',
        vocabulary: null,
      },
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
      ...EMPTY_V12_COLLECTIONS,
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
      story: {
        ...v3Export.story,
        ...V12_STORY,
        statSystem: false,
        statNotation: 'letter',
        vocabulary: null,
      },
      choiceCheckGroups: [],
      choiceChecks: [],
      effects: [],
      ...EMPTY_V5_COLLECTIONS,
      ...EMPTY_V6_COLLECTIONS,
      ...EMPTY_V7_COLLECTIONS,
      ...EMPTY_V8_COLLECTIONS,
      ...EMPTY_V9_COLLECTIONS,
      ...EMPTY_V12_COLLECTIONS,
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
      story: {
        ...v4Export.story,
        ...V12_STORY,
        statSystem: false,
        statNotation: 'letter',
        vocabulary: null,
      },
      ...EMPTY_V5_COLLECTIONS,
      ...EMPTY_V6_COLLECTIONS,
      ...EMPTY_V7_COLLECTIONS,
      ...EMPTY_V8_COLLECTIONS,
      ...EMPTY_V9_COLLECTIONS,
      ...EMPTY_V12_COLLECTIONS,
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
      story: { ...v8Export.story, ...V12_STORY, vocabulary: null },
      ...EMPTY_V9_COLLECTIONS,
      ...EMPTY_V12_COLLECTIONS,
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
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
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

  it('gives every scene of a V10 package an explicit null body, and leaves a written one alone', () => {
    const v10Export = {
      formatVersion: 10,
      story: { id: 'story-10' },
      scenes: [
        { id: 'plain', storyId: 'story-10', summary: 'Only a summary' },
        { id: 'written', storyId: 'story-10', body: 'Once upon a time.' },
        { id: 'blank', storyId: 'story-10', body: null },
      ],
    };

    const migrated = migrateStoryExport(v10Export);

    expect(migrated.formatVersion).toBe(CURRENT_STORY_FORMAT_VERSION);
    expect(migrated.scenes).toEqual([
      { id: 'plain', storyId: 'story-10', summary: 'Only a summary', body: null },
      { id: 'written', storyId: 'story-10', body: 'Once upon a time.' },
      { id: 'blank', storyId: 'story-10', body: null },
    ]);
    // The source is left as it was read.
    expect(v10Export.scenes[0]).not.toHaveProperty('body');
  });

  it('does not invent a scenes collection on a package that has none', () => {
    expect(migrateStoryExport({ formatVersion: 10, story: { id: 'story-10' } })).not.toHaveProperty(
      'scenes',
    );
  });

  it('carries a V9 package through to scenes with a null body as well', () => {
    const migrated = migrateStoryExport({
      formatVersion: 9,
      story: { id: 'story-9' },
      scenes: [{ id: 'scene-9', storyId: 'story-9' }],
    });

    expect(migrated.scenes).toEqual([{ id: 'scene-9', storyId: 'story-9', body: null }]);
  });

  it('gives a V11 package the collections and fields 1.10 added, as what the story had without them', () => {
    const v11Export = {
      formatVersion: 11,
      story: { id: 'story-11', title: 'Old' },
      storyArcs: [
        { id: 'arc-1', storyId: 'story-11', title: 'Arc', isDefault: true },
        { id: 'arc-2', storyId: 'story-11', title: 'Script', medium: 'screenplay', author: 'Ana' },
      ],
      locations: [
        { id: 'place-1', storyId: 'story-11', name: 'Kitchen' },
        { id: 'place-2', storyId: 'story-11', name: 'Yard', intExt: 'exterior' },
      ],
    };

    const migrated = migrateStoryExport(v11Export);

    expect(migrated.formatVersion).toBe(CURRENT_STORY_FORMAT_VERSION);
    expect(migrated.songs).toEqual([]);
    expect(migrated.storySketches).toEqual([]);
    expect(migrated.scenePages).toEqual([]);
    expect(migrated.sceneMusic).toEqual([]);
    expect(migrated.story).toEqual({
      id: 'story-11',
      title: 'Old',
      isNsfw: false,
      coverGalleryId: null,
      // The favourites rule every package without one keeps.
      favoriteBehavior: 'global',
    });
    // What an arc had before: prose, no author, no cover, no page format, the story's own words.
    expect(migrated.storyArcs[0]).toEqual({
      id: 'arc-1',
      storyId: 'story-11',
      title: 'Arc',
      isDefault: true,
      medium: 'generic',
      vocabulary: null,
      author: null,
      coverGalleryId: null,
      pageFormat: null,
    });
    // What a package already says is never touched.
    expect(migrated.storyArcs[1]).toMatchObject({ medium: 'screenplay', author: 'Ana' });
    expect(migrated.locations).toEqual([
      { id: 'place-1', storyId: 'story-11', name: 'Kitchen', intExt: null },
      { id: 'place-2', storyId: 'story-11', name: 'Yard', intExt: 'exterior' },
    ]);
    // The source is left as it was read.
    expect(v11Export.storyArcs[0]).not.toHaveProperty('medium');
    expect(v11Export).not.toHaveProperty('songs');
  });

  it('keeps what a V12 package says, and does not invent arcs or places a V11 one lacked', () => {
    const songs = [{ id: 'song-1', storyId: 'story-12', title: 'Lullaby' }];
    const migrated = migrateStoryExport({
      formatVersion: 11,
      story: { id: 'story-12', isNsfw: true, coverGalleryId: 'cover-1' },
      songs,
    });

    expect(migrated.songs).toBe(songs);
    expect(migrated.story).toMatchObject({ isNsfw: true, coverGalleryId: 'cover-1' });
    expect(migrated).not.toHaveProperty('storyArcs');
    expect(migrated).not.toHaveProperty('locations');
  });

  it('carries a V9 package through to the same place', () => {
    const migrated = migrateStoryExport({
      formatVersion: 9,
      story: { id: 'story-9' },
      scenes: [{ id: 'scene-9', storyId: 'story-9' }],
    });

    expect(migrated.formatVersion).toBe(CURRENT_STORY_FORMAT_VERSION);
    expect(migrated.scenes).toEqual([{ id: 'scene-9', storyId: 'story-9', body: null }]);
    expect(migrated.scenePages).toEqual([]);
    expect(migrated.storyArcs[0]).toMatchObject({ isDefault: true, medium: 'generic' });
  });

  it('rejects an export produced by a newer format', () => {
    expect(() => migrateStoryExport({ formatVersion: CURRENT_STORY_FORMAT_VERSION + 1 })).toThrow(
      StoryExportVersionError,
    );
  });
});
