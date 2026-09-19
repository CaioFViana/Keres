import {
  buildStoryBundleFromPacks,
  findPackConflicts,
  type NewStoryData,
} from '../../src/utils/packBundle';

const pack = (overrides: Record<string, unknown> = {}) =>
  ({
    storySchemaFields: [],
    tags: [],
    suggestions: [],
    statStrengths: [],
    stats: [],
    settings: {},
    ...overrides,
  }) as never;

const story = {
  title: 'New story',
  statSystem: false,
  statNotation: 'numeric',
  vocabulary: null,
} as unknown as NewStoryData;

const extrasOf = (overrides: Record<string, unknown> = {}) => ({
  chapters: [],
  scenes: [],
  characters: [],
  locations: [],
  worldRules: [],
  notes: [],
  storyBoards: [],
  storyLocationMaps: [],
  characterScenes: [],
  characterRelations: [],
  locationRelations: [],
  noteRelations: [],
  tagRelations: [],
  ...overrides,
});

describe('pack bundles', () => {
  it('reports every database-level conflict across selected packs', () => {
    const conflicts = findPackConflicts([
      pack({
        storySchemaFields: [{ entityType: 'Character', key: 'rank' }],
        tags: [{ name: 'Magic' }],
        suggestions: [{ type: 'list', value: 'Fire' }],
        statStrengths: [{ statId: null }],
        stats: Array.from({ length: 8 }, () => ({ isPrimary: true })),
      }),
      pack({
        storySchemaFields: [{ entityType: 'Character', key: 'rank' }],
        tags: [{ name: 'Magic' }],
        suggestions: [{ type: 'list', value: 'Fire' }],
        statStrengths: [{ statId: null }],
        stats: Array.from({ length: 5 }, () => ({ isPrimary: true })),
      }),
    ]);

    expect(conflicts.map((conflict) => conflict.kind).sort()).toEqual([
      'attribute_key',
      'default_ladder',
      'primary_stat_limit',
      'suggestion_value',
      'tag_name',
    ]);
  });

  it('builds an import-shaped clean story with pack rows and no authored relations', () => {
    const bundle = buildStoryBundleFromPacks(story, [
      pack({
        tags: [{ id: 'tag', name: 'Magic' }],
        settings: { statSystem: true, statNotation: 'roman', vocabulary: { version: 1 } },
      }),
    ]);

    expect(bundle.story.id).toBe('PACKSTORYPLACEHOLDER000000');
    expect(bundle.story.version).toBe(1);
    expect(bundle.story.vocabulary).toEqual({ version: 1 });
    expect(bundle.tags).toEqual([{ id: 'tag', name: 'Magic' }]);
    expect(bundle.characterRelations).toEqual([]);
    expect(bundle.attributeValues).toEqual([]);
  });

  it('ignores extras unless asked', () => {
    const bundle = buildStoryBundleFromPacks(
      story,
      [
        pack({
          extras: extrasOf({
            chapters: [{ id: 'ch-1', name: 'Setup' }],
            scenes: [{ id: 'scene-1' }],
          }),
        }),
      ],
      false,
    );

    expect(bundle.chapters).toEqual([]);
    expect(bundle.scenes).toEqual([]);
  });

  it('composes extras into the element collections when asked', () => {
    const bundle = buildStoryBundleFromPacks(
      story,
      [
        pack({
          tags: [{ id: 'tag', name: 'Magic' }],
          extras: extrasOf({
            chapters: [{ id: 'ch-1', name: 'Setup' }],
            scenes: [{ id: 'scene-1', chapterId: 'ch-1', locationId: 'loc-1' }],
            characters: [{ id: 'char-1' }],
            locations: [{ id: 'loc-1' }],
            worldRules: [{ id: 'rule-1' }],
            notes: [{ id: 'note-1' }],
            storyBoards: [{ id: 'board-1', content: { nodes: [], edges: [] } }],
            storyLocationMaps: [{ id: 'map-1', content: { images: [], nodes: [] } }],
            characterScenes: [{ id: 'cs-1', characterId: 'char-1', sceneId: 'scene-1' }],
            characterRelations: [{ id: 'cr-1', character1Id: 'char-1', character2Id: 'char-1' }],
            locationRelations: [{ id: 'lr-1', locationAId: 'loc-1', locationBId: 'loc-1' }],
            noteRelations: [{ id: 'nr-1', noteId: 'note-1', relationId: 'char-1' }],
            tagRelations: [{ id: 'tr-1', tagId: 'tag', relationId: 'char-1' }],
          }),
        }),
      ],
      true,
    );

    expect(bundle.chapters).toHaveLength(1);
    expect(bundle.scenes).toHaveLength(1);
    expect(bundle.characters).toHaveLength(1);
    expect(bundle.locations).toHaveLength(1);
    expect(bundle.worldRules).toHaveLength(1);
    expect(bundle.notes).toHaveLength(1);
    expect(bundle.storyBoards).toHaveLength(1);
    expect(bundle.storyLocationMaps).toHaveLength(1);
    expect(bundle.characterScenes).toHaveLength(1);
    expect(bundle.characterRelations).toHaveLength(1);
    expect(bundle.locationRelations).toHaveLength(1);
    expect(bundle.noteRelations).toHaveLength(1);
    expect(bundle.tagRelations).toHaveLength(1);
    // Every extras row is re-keyed, and every internal reference follows its row.
    const chapterIds = bundle.chapters.map((row) => row.id);
    expect(chapterIds).not.toContain('ch-1');
    expect(bundle.scenes.map((row) => row.chapterId)).toEqual(chapterIds);
    expect(bundle.scenes.map((row) => row.locationId)).toEqual(
      bundle.locations.map((row) => row.id),
    );
    expect(bundle.characterScenes.map((row) => row.sceneId)).toEqual(
      bundle.scenes.map((row) => row.id),
    );
    expect(bundle.noteRelations.map((row) => row.relationId)).toEqual(
      bundle.characters.map((row) => row.id),
    );
    // Schema rows still travel alongside, tags keeping their ids.
    expect(bundle.tags).toEqual([{ id: 'tag', name: 'Magic' }]);
    expect(bundle.tagRelations.map((row) => row.tagId)).toEqual(['tag']);
  });

  it('installs extras per pack when given a flag list', () => {
    const first = pack({
      extras: extrasOf({
        chapters: [{ id: 'ch-1', name: 'Setup' }],
        scenes: [{ id: 'scene-1', chapterId: 'ch-1', locationId: null }],
      }),
    });
    const second = pack({
      extras: extrasOf({
        chapters: [{ id: 'ch-9', name: 'Elsewhere' }],
        scenes: [{ id: 'scene-9', chapterId: 'ch-9', locationId: null }],
      }),
    });

    const bundle = buildStoryBundleFromPacks(story, [first, second], [true, false]);

    expect(bundle.chapters.map((row) => row.name)).toEqual(['Setup']);
    expect(bundle.scenes).toHaveLength(1);
    expect(bundle.scenes.map((row) => row.chapterId)).toEqual(bundle.chapters.map((row) => row.id));

    const neither = buildStoryBundleFromPacks(story, [first, second], [false, false]);
    expect(neither.chapters).toEqual([]);
    expect(neither.scenes).toEqual([]);
  });

  it('gives each pack skeleton its own ids so two packs from one story stay distinct', () => {
    const skeleton = () =>
      extrasOf({
        chapters: [{ id: 'ch-1', name: 'Setup' }],
        scenes: [{ id: 'scene-1', chapterId: 'ch-1', locationId: null }],
      });
    const bundle = buildStoryBundleFromPacks(
      story,
      [pack({ extras: skeleton() }), pack({ extras: skeleton() })],
      true,
    );

    const chapterIds = bundle.chapters.map((row) => row.id);
    expect(chapterIds).toHaveLength(2);
    expect(new Set(chapterIds).size).toBe(2);
    expect(new Set(bundle.scenes.map((row) => row.id)).size).toBe(2);
    // Each scene still follows its own pack's chapter.
    expect(bundle.scenes.map((row) => row.chapterId).sort()).toEqual([...chapterIds].sort());
  });

  it('treats v1 packs without an extras key as carrying nothing extra', () => {
    const bundle = buildStoryBundleFromPacks(story, [pack()], true);

    expect(bundle.chapters).toEqual([]);
    expect(bundle.scenes).toEqual([]);
    expect(bundle.characters).toEqual([]);
  });

  it('suffixes duplicate chapter names across packs without touching unique rows', () => {
    const bundle = buildStoryBundleFromPacks(
      story,
      [
        pack({
          extras: extrasOf({
            chapters: [
              { id: 'ch-1', name: 'Setup' },
              { id: 'ch-2', name: 'Confrontation' },
            ],
          }),
        }),
        pack({ extras: extrasOf({ chapters: [{ id: 'ch-3', name: 'Setup' }] }) }),
      ],
      true,
    );

    expect(bundle.chapters.map((chapter) => chapter.name)).toEqual([
      'Setup',
      'Confrontation',
      'Setup (2)',
    ]);
    // Unique rows keep their names; every row still gets its own fresh id.
    expect(bundle.chapters.map((chapter) => chapter.id)).not.toContain('ch-1');
    expect(new Set(bundle.chapters.map((chapter) => chapter.id)).size).toBe(3);
  });

  it('keeps the first vocabulary seed when more than one pack offers one', () => {
    const bundle = buildStoryBundleFromPacks(story, [
      pack({
        settings: {
          vocabulary: {
            version: 1,
            language: 'en',
            terms: {
              Character: { singular: 'Hero', plural: 'Heroes', grammaticalGender: 'neutral' },
            },
          },
        },
      }),
      pack({
        settings: {
          vocabulary: {
            version: 1,
            language: 'en',
            terms: {
              Character: { singular: 'Actor', plural: 'Actors', grammaticalGender: 'neutral' },
            },
          },
        },
      }),
    ]);
    expect(bundle.story.vocabulary?.terms.Character?.singular).toBe('Hero');
  });
});
