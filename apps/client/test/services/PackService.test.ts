/**
 * @jest-environment node
 */
import { AttributeType, validatePackContent } from '@keres/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createPackService, packHasExtras } from '../../src/services/storymanagement/PackService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * A pack is the *shape* of a story plus, when asked, element skeletons as extras.
 *
 * Most of these assertions are about what must NOT come along: an attribute value, a character's
 * stat, gallery bytes. A pack that carried those would be a story, and the feature's whole promise
 * - apply at creation, zero operations, bootstrap to the server whole - rests on it staying small.
 */

let database: TestDatabase;

const ALL_OFF = {
  customAttributes: false,
  suggestions: false,
  suggestionsIncludeUsed: false,
  stats: false,
  tags: false,
  extras: false,
};

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

afterEach(() => database.close());

async function seedStructure() {
  await database.db.insert(schema.storySchemaFields).values({
    id: '01ARZ3NDEKTSV4RRFFQ69G5F01',
    storyId: TEST_STORY_ID,
    entityType: 'Character',
    name: 'Allegiance',
    key: 'allegiance',
    description: null,
    type: AttributeType.SUGGESTION,
    targetEntityType: null,
    isRequired: false,
    defaultValue: null,
    order: 0,
    ...entityBase,
  });
  await database.db.insert(schema.tags).values({
    id: '01ARZ3NDEKTSV4RRFFQ69G5F02',
    storyId: TEST_STORY_ID,
    name: 'Flashback',
    color: '#abcdef',
    ...entityBase,
  });
  await database.db.insert(schema.stats).values({
    id: '01ARZ3NDEKTSV4RRFFQ69G5F03',
    storyId: TEST_STORY_ID,
    name: 'Strength',
    isPrimary: true,
    order: 0,
    ...entityBase,
  });
  await database.db.insert(schema.statStrengths).values({
    id: '01ARZ3NDEKTSV4RRFFQ69G5F04',
    storyId: TEST_STORY_ID,
    statId: null,
    label: 'F',
    minValue: 0,
    ...entityBase,
  });
  await database.db.insert(schema.suggestions).values({
    id: '01ARZ3NDEKTSV4RRFFQ69G5F05',
    storyId: TEST_STORY_ID,
    type: 'character_race',
    value: 'Elf',
    ...entityBase,
  });
}

const CHAR_A = '01ARZ3NDEKTSV4RRFFQ69G5FA1';
const CHAR_B = '01ARZ3NDEKTSV4RRFFQ69G5FA2';
const CHAR_GONE = '01ARZ3NDEKTSV4RRFFQ69G5FA3';
// Character rows validate `storyId` as a ULID, and the shared `story-test` id is not one, so
// element seeds live under their own story.
const EXTRAS_STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FA0';

/** Elements plus the dangling references extraction must sanitize or drop. */
async function seedElements() {
  const db = database.db;
  await seedLocalStory(database, { id: EXTRAS_STORY_ID, title: 'Seeded' });
  const storyId = EXTRAS_STORY_ID;
  await db.insert(schema.chapters).values([
    { id: 'ch-1', storyId, name: 'Setup', index: 1, ...entityBase },
    { id: 'ch-arc', storyId, name: 'Arc-bound', index: 2, arcId: 'arc-9', ...entityBase },
    { id: 'ch-gone', storyId, name: 'Cut', index: 3, ...entityBase, isDeleted: true },
  ]);
  await db.insert(schema.locations).values([
    { id: 'loc-1', storyId, name: 'Keep', ...entityBase },
    { id: 'loc-2', storyId, name: 'Harbor', ...entityBase },
    { id: 'loc-gone', storyId, name: 'Ruins', ...entityBase, isDeleted: true },
  ]);
  await db.insert(schema.scenes).values([
    {
      id: 'scene-filed',
      storyId,
      chapterId: 'ch-1',
      locationId: 'loc-1',
      name: 'Arrival',
      index: 0,
      isStart: true,
      isFinish: false,
      ...entityBase,
    },
    {
      id: 'scene-fragment',
      storyId,
      chapterId: null,
      locationId: null,
      name: 'Fragment',
      index: 1,
      isStart: false,
      isFinish: false,
      ...entityBase,
    },
    {
      id: 'scene-orphan',
      storyId,
      chapterId: 'ch-gone',
      locationId: 'loc-gone',
      name: 'Orphan',
      index: 2,
      isStart: false,
      isFinish: false,
      ...entityBase,
    },
    {
      id: 'scene-unplaced',
      storyId,
      chapterId: 'ch-1',
      locationId: 'loc-gone',
      name: 'Wanderer',
      index: 3,
      isStart: false,
      isFinish: false,
      ...entityBase,
    },
  ]);
  await db.insert(schema.characters).values([
    { id: CHAR_A, storyId, name: 'Aria', ...entityBase },
    { id: CHAR_B, storyId, name: 'Bram', ...entityBase },
    { id: CHAR_GONE, storyId, name: 'Ghost', ...entityBase, isDeleted: true },
  ]);
  await db
    .insert(schema.worldRules)
    .values([{ id: 'rule-1', storyId, title: 'Iron costs', ...entityBase }]);
  await db.insert(schema.notes).values([{ id: 'note-1', storyId, title: 'Hook', ...entityBase }]);
  await db
    .insert(schema.tags)
    .values([{ id: 'tag-1', storyId, name: 'seed', color: null, ...entityBase }]);
  await db.insert(schema.boards).values([
    {
      id: 'board-1',
      storyId,
      name: 'Cast',
      content: {
        nodes: [
          {
            id: 'AAAAAAAA',
            kind: 'entity',
            x: 0,
            y: 0,
            entityType: 'Character',
            entityId: CHAR_A,
            labelAtPin: 'Aria',
          },
          {
            id: 'BBBBBBBB',
            kind: 'entity',
            x: 10,
            y: 10,
            entityType: 'Character',
            entityId: 'ghost-9',
            labelAtPin: 'Ghost',
          },
        ],
        edges: [],
      },
      ...entityBase,
    },
  ]);
  await db.insert(schema.locationMaps).values([
    {
      id: 'map-1',
      storyId,
      name: 'Realm',
      content: {
        images: [
          {
            id: 'AAAAAAAA',
            galleryId: 'gallery-9',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            locked: false,
          },
        ],
        nodes: [
          {
            id: 'BBBBBBBB',
            locationId: 'loc-1',
            x: 0,
            y: 0,
            icon: 'pin',
            color: '#ffffff',
            destinationMapId: 'map-missing',
          },
        ],
        markers: [
          {
            id: 'CCCCCCCC',
            x: 1,
            y: 1,
            title: 'Loot',
            icon: 'star',
            color: '#ffffff',
            destinationMapId: 'map-2',
          },
        ],
        relationTexts: [
          { sourceLocationId: 'loc-1', destinationLocationId: 'loc-2', text: 'ferry' },
        ],
      },
      ...entityBase,
    },
    {
      id: 'map-2',
      storyId,
      name: 'City',
      content: { images: [], nodes: [] },
      ...entityBase,
    },
  ]);
  await db.insert(schema.characterScenes).values([
    { id: 'cs-1', storyId, characterId: CHAR_A, sceneId: 'scene-filed', ...entityBase },
    { id: 'cs-gone', storyId, characterId: CHAR_GONE, sceneId: 'scene-filed', ...entityBase },
    { id: 'cs-fragment', storyId, characterId: CHAR_A, sceneId: 'scene-fragment', ...entityBase },
  ]);
  await db.insert(schema.characterRelations).values([
    {
      id: 'cr-1',
      storyId,
      character1Id: CHAR_A,
      character2Id: CHAR_B,
      relationType: 'siblings',
      ...entityBase,
    },
    {
      id: 'cr-gone',
      storyId,
      character1Id: CHAR_A,
      character2Id: CHAR_GONE,
      relationType: 'haunts',
      ...entityBase,
    },
  ]);
  await db.insert(schema.locationRelations).values([
    {
      id: 'lr-1',
      storyId,
      locationAId: 'loc-1',
      locationBId: 'loc-2',
      relationType: 'contains',
      ...entityBase,
    },
    {
      id: 'lr-gone',
      storyId,
      locationAId: 'loc-1',
      locationBId: 'loc-gone',
      relationType: 'contains',
      ...entityBase,
    },
  ]);
  await db.insert(schema.noteRelations).values([
    {
      id: 'nr-1',
      storyId,
      noteId: 'note-1',
      relationId: CHAR_A,
      relationType: 'Character',
      ...entityBase,
    },
    {
      id: 'nr-choice',
      storyId,
      noteId: 'note-1',
      relationId: 'choice-9',
      relationType: 'Choice',
      ...entityBase,
    },
    {
      id: 'nr-gone',
      storyId,
      noteId: 'note-1',
      relationId: CHAR_GONE,
      relationType: 'Character',
      ...entityBase,
    },
  ]);
  await db.insert(schema.tagRelations).values([
    {
      id: 'tr-1',
      storyId,
      tagId: 'tag-1',
      relationId: 'scene-filed',
      relationType: 'Scene',
      ...entityBase,
    },
    {
      id: 'tr-tag-gone',
      storyId,
      tagId: 'tag-missing',
      relationId: 'scene-filed',
      relationType: 'Scene',
      ...entityBase,
    },
    {
      id: 'tr-item',
      storyId,
      tagId: 'tag-1',
      relationId: 'item-9',
      relationType: 'Item',
      ...entityBase,
    },
    {
      id: 'tr-orphan',
      storyId,
      tagId: 'tag-1',
      relationId: 'scene-orphan',
      relationType: 'Scene',
      ...entityBase,
    },
  ]);
}

describe('extracting a pack from a story', () => {
  it('takes nothing when every toggle is off', async () => {
    await seedStructure();
    const content = await createPackService(database.db).extractFromStory(TEST_STORY_ID, ALL_OFF);

    expect(content.storySchemaFields).toEqual([]);
    expect(content.suggestions).toEqual([]);
    expect(content.tags).toEqual([]);
    expect(content.stats).toEqual([]);
    expect(content.settings.statSystem).toBe(false);
  });

  it('takes each kind only when its own toggle is on', async () => {
    await seedStructure();
    const service = createPackService(database.db);

    const onlyTags = await service.extractFromStory(TEST_STORY_ID, { ...ALL_OFF, tags: true });
    expect(onlyTags.tags).toHaveLength(1);
    expect(onlyTags.storySchemaFields).toEqual([]);

    const onlyFields = await service.extractFromStory(TEST_STORY_ID, {
      ...ALL_OFF,
      customAttributes: true,
    });
    expect(onlyFields.storySchemaFields).toHaveLength(1);
    expect(onlyFields.tags).toEqual([]);
  });

  /**
   * A pack carrying stat axes without turning the system on would visibly do nothing: the stats
   * screens stay hidden until `statSystem` is true, and it can only be set at creation.
   */
  it('turns the stat system on when it carries stats, and leaves it alone otherwise', async () => {
    await seedStructure();
    const service = createPackService(database.db);

    const withStats = await service.extractFromStory(TEST_STORY_ID, { ...ALL_OFF, stats: true });
    expect(withStats.stats).toHaveLength(1);
    expect(withStats.statStrengths).toHaveLength(1);
    expect(withStats.settings.statSystem).toBe(true);

    const withoutStats = await service.extractFromStory(TEST_STORY_ID, { ...ALL_OFF, tags: true });
    expect(withoutStats.settings.statSystem).toBe(false);
  });

  it('never carries the writer content that would make it a story', async () => {
    await seedStructure();
    await database.db.insert(schema.characters).values({
      id: '01ARZ3NDEKTSV4RRFFQ69G5F06',
      storyId: TEST_STORY_ID,
      name: 'Someone',
      ...entityBase,
    });
    await database.db.insert(schema.statRelations).values({
      id: '01ARZ3NDEKTSV4RRFFQ69G5F07',
      storyId: TEST_STORY_ID,
      characterId: '01ARZ3NDEKTSV4RRFFQ69G5F06',
      modeId: null,
      statId: '01ARZ3NDEKTSV4RRFFQ69G5F03',
      value: 10,
      ...entityBase,
    });

    const content = await createPackService(database.db).extractFromStory(TEST_STORY_ID, {
      customAttributes: true,
      suggestions: true,
      suggestionsIncludeUsed: true,
      stats: true,
      tags: true,
      extras: false,
    });

    // The pack's shape is fixed by the schema: there is nowhere for a stat value to go,
    // and extras stay empty unless their toggle is on.
    expect(Object.keys(content).sort()).toEqual(
      [
        'extras',
        'formatVersion',
        'settings',
        'statStrengths',
        'stats',
        'storySchemaFields',
        'suggestions',
        'tags',
      ].sort(),
    );
    expect(Object.values(content.extras).flat()).toEqual([]);
  });

  it('leaves a deleted row behind', async () => {
    await seedStructure();
    await database.db
      .update(schema.tags)
      .set({ isDeleted: true })
      .where(eq(schema.tags.id, '01ARZ3NDEKTSV4RRFFQ69G5F02'));

    const content = await createPackService(database.db).extractFromStory(TEST_STORY_ID, {
      ...ALL_OFF,
      tags: true,
    });

    expect(content.tags).toEqual([]);
  });

  /**
   * The `suggestions` table is the *curated* catalogue - what the writer deliberately saved. Values
   * merely used by entities are harvested on demand and never stored, so the toggle is exactly the
   * line the data already draws.
   */
  it('takes the curated catalogue by default and sweeps in used values only when asked', async () => {
    await seedStructure();
    await database.db.insert(schema.characters).values({
      id: '01ARZ3NDEKTSV4RRFFQ69G5F08',
      storyId: TEST_STORY_ID,
      name: 'Dwarf person',
      race: 'Dwarf',
      ...entityBase,
    });
    const service = createPackService(database.db);

    const curated = await service.extractFromStory(TEST_STORY_ID, {
      ...ALL_OFF,
      suggestions: true,
    });
    expect(curated.suggestions.map((suggestion) => suggestion.value)).toEqual(['Elf']);

    const withUsed = await service.extractFromStory(TEST_STORY_ID, {
      ...ALL_OFF,
      suggestions: true,
      suggestionsIncludeUsed: true,
    });
    expect(withUsed.suggestions.map((suggestion) => suggestion.value).sort()).toEqual([
      'Dwarf',
      'Elf',
    ]);
  });
});

describe('extracting extras', () => {
  it('harvests live elements and leaves deleted rows behind', async () => {
    await seedElements();
    const content = await createPackService(database.db).extractFromStory(EXTRAS_STORY_ID, {
      ...ALL_OFF,
      tags: true,
      extras: true,
    });

    expect(content.extras.chapters.map((row) => row.id).sort()).toEqual(['ch-1', 'ch-arc']);
    expect(content.extras.scenes.map((row) => row.id).sort()).toEqual([
      'scene-filed',
      'scene-fragment',
      'scene-orphan',
      'scene-unplaced',
    ]);
    expect(content.extras.characters.map((row) => row.id).sort()).toEqual([CHAR_A, CHAR_B]);
    expect(content.extras.locations.map((row) => row.id).sort()).toEqual(['loc-1', 'loc-2']);
    expect(content.extras.worldRules).toHaveLength(1);
    expect(content.extras.notes).toHaveLength(1);
    expect(content.extras.storyBoards).toHaveLength(1);
    expect(content.extras.storyLocationMaps).toHaveLength(2);
  });

  it('nulls references to rows outside the harvest instead of carrying them', async () => {
    await seedElements();
    const content = await createPackService(database.db).extractFromStory(EXTRAS_STORY_ID, {
      ...ALL_OFF,
      extras: true,
    });

    // Unfiled scenes travel as unfiled, exactly as story export carries them.
    const byId = Object.fromEntries(content.extras.scenes.map((row) => [row.id, row]));
    expect(byId['scene-filed']).toMatchObject({ chapterId: 'ch-1', locationId: 'loc-1' });
    expect(byId['scene-fragment']).toMatchObject({ chapterId: null, locationId: null });
    expect(byId['scene-orphan']).toMatchObject({ chapterId: null, locationId: null });
    expect(byId['scene-unplaced']).toMatchObject({ chapterId: 'ch-1', locationId: null });
    expect(content.extras.chapters.find((row) => row.id === 'ch-arc')?.arcId).toBeNull();
  });

  it('drops joins whose endpoints do not travel along', async () => {
    await seedElements();
    const content = await createPackService(database.db).extractFromStory(EXTRAS_STORY_ID, {
      ...ALL_OFF,
      tags: true,
      extras: true,
    });

    // cs-fragment and tr-orphan join unfiled scenes, which travel - so they travel too.
    // Only joins to rows outside every carried collection go.
    expect(content.extras.characterScenes.map((row) => row.id).sort()).toEqual([
      'cs-1',
      'cs-fragment',
    ]);
    expect(content.extras.characterRelations.map((row) => row.id)).toEqual(['cr-1']);
    expect(content.extras.locationRelations.map((row) => row.id)).toEqual(['lr-1']);
    // A Choice target is not a carried element type, and the ghost character is gone.
    expect(content.extras.noteRelations.map((row) => row.id)).toEqual(['nr-1']);
    expect(content.extras.tagRelations.map((row) => row.id).sort()).toEqual(['tr-1', 'tr-orphan']);
  });

  it('drops tag relations when the tags toggle is off', async () => {
    await seedElements();
    const content = await createPackService(database.db).extractFromStory(EXTRAS_STORY_ID, {
      ...ALL_OFF,
      extras: true,
    });

    expect(content.tags).toEqual([]);
    expect(content.extras.tagRelations).toEqual([]);
    // Other joins are unaffected by the tags toggle.
    expect(content.extras.noteRelations.map((row) => row.id)).toEqual(['nr-1']);
  });

  it('drops map images but keeps ghost pins and sanitizes map destinations', async () => {
    await seedElements();
    const content = await createPackService(database.db).extractFromStory(EXTRAS_STORY_ID, {
      ...ALL_OFF,
      extras: true,
    });

    const board = content.extras.storyBoards[0];
    expect(board?.content.nodes).toHaveLength(2);
    const pins = (board?.content.nodes ?? []).flatMap((node) =>
      node.kind === 'entity' ? [node.entityId] : [],
    );
    expect(pins.sort()).toEqual([CHAR_A, 'ghost-9']);

    const map = content.extras.storyLocationMaps.find((row) => row.id === 'map-1');
    expect(map?.content.images).toEqual([]);
    expect(map?.content.nodes).toHaveLength(1);
    expect(map?.content.nodes[0]).toMatchObject({ locationId: 'loc-1', destinationMapId: null });
    expect(map?.content.markers?.[0]).toMatchObject({ destinationMapId: 'map-2' });
    expect(map?.content.relationTexts).toHaveLength(1);
  });

  it('harvests nothing extra when the toggle is off', async () => {
    await seedElements();
    const content = await createPackService(database.db).extractFromStory(EXTRAS_STORY_ID, ALL_OFF);

    expect(Object.values(content.extras).flat()).toEqual([]);
  });

  it('harvests content that validates by construction', async () => {
    await seedElements();
    const content = await createPackService(database.db).extractFromStory(EXTRAS_STORY_ID, {
      ...ALL_OFF,
      tags: true,
      extras: true,
    });

    expect(() => validatePackContent(JSON.parse(JSON.stringify(content)))).not.toThrow();
  });
});

describe('storing packs', () => {
  it('prefills the language and the author from the source story, and keeps an override', async () => {
    await seedStructure();
    await database.db
      .update(schema.stories)
      .set({ language: 'pt', author: 'Quem Escreveu' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
    const service = createPackService(database.db);

    const prefilled = await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'Prefilled',
      selection: { ...ALL_OFF, tags: true },
    });
    const overridden = await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'Overridden',
      language: 'en',
      authorName: 'Somebody Else',
      selection: { ...ALL_OFF, tags: true },
    });

    const packs = await service.listPacks();
    const byId = new Map(packs.map((pack) => [pack.id, pack]));
    expect(byId.get(prefilled)).toMatchObject({ language: 'pt', authorName: 'Quem Escreveu' });
    expect(byId.get(overridden)).toMatchObject({ language: 'en', authorName: 'Somebody Else' });
  });

  it('describes what a pack carries without opening its payload twice', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'Everything',
      selection: {
        customAttributes: true,
        suggestions: true,
        suggestionsIncludeUsed: false,
        stats: true,
        tags: true,
        extras: false,
      },
    });

    const [pack] = await service.listPacks();
    expect(pack?.counts).toEqual({
      customAttributes: 1,
      suggestions: 1,
      tags: 1,
      extras: {
        chapters: 0,
        scenes: 0,
        characters: 0,
        locations: 0,
        worldRules: 0,
        notes: 0,
        storyBoards: 0,
        storyLocationMaps: 0,
      },
      stats: 1,
      hasVocabulary: false,
    });
    expect(pack?.version).toBe(1);
  });

  it('reports whether a pack carries any skeleton for the install switch', async () => {
    await seedElements();
    const service = createPackService(database.db);
    await service.createPack({
      sourceStoryId: EXTRAS_STORY_ID,
      name: 'Skeleton',
      selection: { ...ALL_OFF, extras: true },
    });
    await service.createPack({
      sourceStoryId: EXTRAS_STORY_ID,
      name: 'Schema',
      selection: { ...ALL_OFF, tags: true },
    });

    const byName = Object.fromEntries(
      (await service.listPacks()).map((pack) => [pack.name, pack.counts]),
    );
    expect(packHasExtras(byName['Skeleton'])).toBe(true);
    expect(packHasExtras(byName['Schema'])).toBe(false);
    expect(packHasExtras(undefined)).toBe(false);
  });

  it('re-extracts from the source story and bumps the version', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const packId = await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'Growing',
      selection: { ...ALL_OFF, tags: true },
    });

    await database.db.insert(schema.tags).values({
      id: '01ARZ3NDEKTSV4RRFFQ69G5F09',
      storyId: TEST_STORY_ID,
      name: 'Dream',
      color: '#123456',
      ...entityBase,
    });
    await service.reextractPack(packId, { ...ALL_OFF, tags: true });

    const [pack] = await service.listPacks();
    expect(pack?.version).toBe(2);
    expect(pack?.counts.tags).toBe(2);
  });

  it('refuses to re-extract a pack whose source story is gone', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const packId = await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'Orphan',
      selection: { ...ALL_OFF, tags: true },
    });
    await database.db
      .update(schema.packs)
      .set({ sourceStoryId: null })
      .where(eq(schema.packs.id, packId));

    await expect(service.reextractPack(packId, { ...ALL_OFF, tags: true })).rejects.toThrow(
      /source story/i,
    );
  });

  it('keeps the stored payload readable after a round trip', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const packId = await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'Round trip',
      selection: { ...ALL_OFF, customAttributes: true, stats: true },
    });

    const content = await service.getPackContent(packId);
    expect(content?.storySchemaFields).toHaveLength(1);
    expect(content?.stats).toHaveLength(1);
    expect(content?.settings.statSystem).toBe(true);
  });

  it('deletes a pack outright - there is no tombstone to keep', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const packId = await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'Doomed',
      selection: { ...ALL_OFF, tags: true },
    });

    await service.deletePack(packId);

    expect(await service.listPacks()).toEqual([]);
    expect(await service.getPackContent(packId)).toBeNull();
  });
});

describe('the operation log', () => {
  /**
   * Extracting reads the story and writes only to `packs`, which is outside the sync engine. If a
   * single operation were recorded here, a pack made from a synchronized story would push a change
   * nobody made.
   */
  it('records nothing when a pack is created', async () => {
    await seedStructure();
    const before = await database.db.select().from(schema.operationLogs).all();

    await createPackService(database.db).createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'Silent',
      selection: {
        customAttributes: true,
        suggestions: true,
        suggestionsIncludeUsed: true,
        stats: true,
        tags: true,
        extras: false,
      },
    });

    const after = await database.db.select().from(schema.operationLogs).all();
    expect(after).toHaveLength(before.length);
  });
});

/**
 * Applying is the half that has to hold up: it creates a real story, through the import path, and
 * the story then has to be indistinguishable from one made by hand.
 */
describe('applying packs at story creation', () => {
  // A real ULID: the bundle goes through `FullStoryExportSchema`, which validates it. The seed
  // helper's `local-user` is fine for direct inserts but not for the import path.
  const PACK_USER_ID = '01ARZ3NDEKTSV4RRFFQ69G5FUS';

  const NEW_STORY = {
    userId: PACK_USER_ID,
    title: 'Made from a pack',
    type: 'linear' as const,
    description: null,
    genre: null,
    language: null,
    author: null,
    isFavorite: false,
    favoriteBehavior: 'individual' as const,
    extraNotes: null,
    theme: null,
    timelineEpochDay: null,
    normalizeSceneTiming: false,
    allowReaderComments: false,
    autoLinkMentions: true,
    completenessChecks: false,
    statSystem: false,
    statNotation: 'letter' as const,
    lastOperationLog: 0,
    lastServerSyncedLog: 0,
  };

  async function packFrom(selection: Partial<typeof ALL_OFF> = {}, sourceStoryId = TEST_STORY_ID) {
    return createPackService(database.db).createPack({
      sourceStoryId,
      name: 'Source',
      selection: { ...ALL_OFF, ...selection },
    });
  }

  it('creates a story carrying the pack, with ids of its own', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const packId = await packFrom({ customAttributes: true, tags: true });

    const storyId = await service.createStoryWithPacks(PACK_USER_ID, NEW_STORY, [packId]);

    expect(storyId).not.toBe(TEST_STORY_ID);
    const fields = await database.db.query.storySchemaFields.findMany();
    const created = fields.filter((field) => field.storyId === storyId);
    expect(created).toHaveLength(1);
    expect(created[0]?.key).toBe('allegiance');
    // The source story's rows must not have been moved or reused.
    expect(created[0]?.id).not.toBe('01ARZ3NDEKTSV4RRFFQ69G5F01');
    expect(fields.filter((field) => field.storyId === TEST_STORY_ID)).toHaveLength(1);
  });

  /**
   * The property the whole design rests on: a story made from packs can be sent to a server by the
   * existing bootstrap, because there is no operation history to reconcile.
   */
  it('records no operations for the story it creates', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const packId = await packFrom({ customAttributes: true, suggestions: true, tags: true });
    const before = await database.db.select().from(schema.operationLogs).all();

    const storyId = await service.createStoryWithPacks(PACK_USER_ID, NEW_STORY, [packId]);

    const after = await database.db.select().from(schema.operationLogs).all();
    expect(after).toHaveLength(before.length);
    expect(after.filter((entry) => entry.storyId === storyId)).toHaveLength(0);
  });

  it('turns the stat system on for the new story when a pack carries stats', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const packId = await packFrom({ stats: true });

    const storyId = await service.createStoryWithPacks(PACK_USER_ID, NEW_STORY, [packId]);

    const story = await database.db.query.stories.findFirst({
      where: eq(schema.stories.id, storyId),
    });
    expect(story?.statSystem).toBe(true);
    const stats = await database.db.query.stats.findMany();
    expect(stats.filter((stat) => stat.storyId === storyId)).toHaveLength(1);
  });

  it('creates an empty story when no pack is chosen', async () => {
    await seedStructure();
    const storyId = await createPackService(database.db).createStoryWithPacks(
      PACK_USER_ID,
      NEW_STORY,
      [],
    );

    const fields = await database.db.query.storySchemaFields.findMany();
    expect(fields.filter((field) => field.storyId === storyId)).toHaveLength(0);
    expect(
      (await database.db.query.stories.findFirst({ where: eq(schema.stories.id, storyId) }))?.title,
    ).toBe('Made from a pack');
  });

  /**
   * Each of these is a constraint the database really enforces, so the picker has to catch it
   * before the import opens a transaction.
   */
  it('reports a duplicate attribute key between two packs instead of creating the story', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const first = await packFrom({ customAttributes: true });
    const second = await packFrom({ customAttributes: true });

    const conflicts = await service.findConflicts([first, second]);
    expect(conflicts).toEqual([
      { kind: 'attribute_key', detail: expect.stringContaining('allegiance') },
    ]);

    await expect(
      service.createStoryWithPacks(PACK_USER_ID, NEW_STORY, [first, second]),
    ).rejects.toThrow(/conflict/i);
  });

  it('reports a duplicate tag name and a duplicate suggestion value', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const first = await packFrom({ tags: true, suggestions: true });
    const second = await packFrom({ tags: true, suggestions: true });

    const kinds = (await service.findConflicts([first, second])).map((conflict) => conflict.kind);
    expect(kinds).toContain('tag_name');
    expect(kinds).toContain('suggestion_value');
  });

  it('reports two story-default ladders', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const first = await packFrom({ stats: true });
    const second = await packFrom({ stats: true });

    expect((await service.findConflicts([first, second])).map((c) => c.kind)).toContain(
      'default_ladder',
    );
  });

  it('finds nothing wrong with a single pack', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const packId = await packFrom({
      customAttributes: true,
      suggestions: true,
      tags: true,
      stats: true,
    });

    expect(await service.findConflicts([packId])).toEqual([]);
  });

  it('creates the skeleton as ordinary elements with fresh ids when extras are on', async () => {
    await seedElements();
    const service = createPackService(database.db);
    const packId = await packFrom({ tags: true, extras: true }, EXTRAS_STORY_ID);

    const storyId = await service.createStoryWithPacks(PACK_USER_ID, NEW_STORY, [packId], true);

    const chapters = (await database.db.query.chapters.findMany()).filter(
      (row) => row.storyId === storyId,
    );
    expect(chapters.map((row) => row.name).sort()).toEqual(['Arc-bound', 'Setup']);
    expect(chapters.every((row) => row.id !== 'ch-1' && row.id !== 'ch-arc')).toBe(true);
    const scenes = (await database.db.query.scenes.findMany()).filter(
      (row) => row.storyId === storyId,
    );
    // Unfiled scenes arrive as unfiled, exactly as story import restores them.
    expect(scenes.map((row) => row.name).sort()).toEqual([
      'Arrival',
      'Fragment',
      'Orphan',
      'Wanderer',
    ]);
    const characters = (await database.db.query.characters.findMany()).filter(
      (row) => row.storyId === storyId,
    );
    expect(characters.map((row) => row.name).sort()).toEqual(['Aria', 'Bram']);
    // Relations survive the remap: each link still joins the linked rows, including the one
    // to the unfiled Fragment.
    const links = (await database.db.query.characterScenes.findMany()).filter(
      (row) => row.storyId === storyId,
    );
    expect(links).toHaveLength(2);
    const scenesByName = Object.fromEntries(scenes.map((row) => [row.name, row.id]));
    const charactersByName = Object.fromEntries(characters.map((row) => [row.name, row.id]));
    expect(links).toContainEqual(
      expect.objectContaining({
        characterId: charactersByName['Aria'],
        sceneId: scenesByName['Arrival'],
      }),
    );
    expect(links).toContainEqual(
      expect.objectContaining({
        characterId: charactersByName['Aria'],
        sceneId: scenesByName['Fragment'],
      }),
    );
  });

  it('merges two packs skeletons without conflicts, suffixing repeated chapters', async () => {
    await seedElements();
    const service = createPackService(database.db);
    const first = await packFrom({ extras: true }, EXTRAS_STORY_ID);
    const second = await packFrom({ extras: true }, EXTRAS_STORY_ID);

    expect(await service.findConflicts([first, second])).toEqual([]);

    const storyId = await service.createStoryWithPacks(
      PACK_USER_ID,
      NEW_STORY,
      [first, second],
      true,
    );

    const chapters = (await database.db.query.chapters.findMany()).filter(
      (row) => row.storyId === storyId,
    );
    expect(chapters.map((row) => row.name).sort()).toEqual([
      'Arc-bound',
      'Arc-bound (2)',
      'Setup',
      'Setup (2)',
    ]);
    // Both packs were cut from the same story, so they carried the same row ids: each pack's
    // skeleton arrives as its own rows rather than colliding on the way in.
    const scenes = (await database.db.query.scenes.findMany()).filter(
      (row) => row.storyId === storyId,
    );
    expect(scenes).toHaveLength(8);
    expect(new Set(scenes.map((row) => row.id)).size).toBe(8);
  });

  it('installs extras only for the packs named, leaving the others schema-only', async () => {
    await seedElements();
    const service = createPackService(database.db);
    const first = await packFrom({ extras: true }, EXTRAS_STORY_ID);
    const second = await packFrom({ extras: true }, EXTRAS_STORY_ID);

    const storyId = await service.createStoryWithPacks(
      PACK_USER_ID,
      NEW_STORY,
      [first, second],
      [first],
    );

    const chapters = (await database.db.query.chapters.findMany()).filter(
      (row) => row.storyId === storyId,
    );
    // One skeleton, so no suffixes: the second pack contributed structure alone.
    expect(chapters.map((row) => row.name).sort()).toEqual(['Arc-bound', 'Setup']);
    const scenes = (await database.db.query.scenes.findMany()).filter(
      (row) => row.storyId === storyId,
    );
    expect(scenes).toHaveLength(4);
  });

  it('records no operations for the skeleton it creates', async () => {
    await seedElements();
    const service = createPackService(database.db);
    const packId = await packFrom({ extras: true }, EXTRAS_STORY_ID);
    const before = await database.db.select().from(schema.operationLogs).all();

    const storyId = await service.createStoryWithPacks(PACK_USER_ID, NEW_STORY, [packId], true);

    const after = await database.db.select().from(schema.operationLogs).all();
    expect(after).toHaveLength(before.length);
    expect(after.filter((entry) => entry.storyId === storyId)).toHaveLength(0);
  });

  it('creates schema only when extras are off', async () => {
    await seedElements();
    const service = createPackService(database.db);
    const packId = await packFrom({ tags: true, extras: true }, EXTRAS_STORY_ID);

    const storyId = await service.createStoryWithPacks(PACK_USER_ID, NEW_STORY, [packId], false);

    expect(
      (await database.db.query.chapters.findMany()).filter((row) => row.storyId === storyId),
    ).toHaveLength(0);
    expect(
      (await database.db.query.characters.findMany()).filter((row) => row.storyId === storyId),
    ).toHaveLength(0);
    expect(
      (await database.db.query.tags.findMany()).filter((row) => row.storyId === storyId),
    ).toHaveLength(1);
  });

  it('treats a v1 pack row as carrying nothing extra', async () => {
    await seedElements();
    const service = createPackService(database.db);
    const now = new Date();
    const packId = 'pack-v1-without-extras';
    await database.db.insert(schema.packs).values({
      id: packId,
      name: 'Legacy',
      description: null,
      language: null,
      authorName: null,
      version: 1,
      content: JSON.stringify({
        formatVersion: 1,
        storySchemaFields: [],
        suggestions: [],
        tags: [],
        stats: [],
        statStrengths: [],
        settings: { statSystem: false, statNotation: 'letter' },
      }),
      sourceStoryId: null,
      createdAt: now,
      updatedAt: now,
    });

    const storyId = await service.createStoryWithPacks(PACK_USER_ID, NEW_STORY, [packId], true);

    expect(
      (await database.db.query.chapters.findMany()).filter((row) => row.storyId === storyId),
    ).toHaveLength(0);
    expect(
      (await database.db.query.stories.findFirst({ where: eq(schema.stories.id, storyId) }))?.title,
    ).toBe('Made from a pack');
  });
});

/**
 * A `custom:<fieldId>` catalogue is reachable only through the field it belongs to. Shipping one
 * without its field is how `cloneExampleStory` orphaned 96 rows in the bundled examples; a pack must
 * not be able to reproduce that.
 */
describe('pack self-consistency', () => {
  beforeEach(async () => {
    await seedStructure();
    await database.db.insert(schema.suggestions).values({
      id: '01ARZ3NDEKTSV4RRFFQ69G5F10',
      storyId: TEST_STORY_ID,
      type: 'custom:01ARZ3NDEKTSV4RRFFQ69G5F01',
      value: 'Rebellion',
      ...entityBase,
    });
  });

  it('drops a custom catalogue when its field is not coming along', async () => {
    const content = await createPackService(database.db).extractFromStory(TEST_STORY_ID, {
      ...ALL_OFF,
      suggestions: true,
    });

    expect(content.suggestions.map((suggestion) => suggestion.type)).toEqual(['character_race']);
  });

  it('keeps the catalogue when the field comes along', async () => {
    const content = await createPackService(database.db).extractFromStory(TEST_STORY_ID, {
      ...ALL_OFF,
      suggestions: true,
      customAttributes: true,
    });

    expect(content.suggestions.map((suggestion) => suggestion.type).sort()).toEqual([
      'character_race',
      'custom:01ARZ3NDEKTSV4RRFFQ69G5F01',
    ]);
  });

  it('keeps the catalogue reachable after the pack is applied', async () => {
    const service = createPackService(database.db);
    const packId = await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'With catalogue',
      selection: { ...ALL_OFF, suggestions: true, customAttributes: true },
    });

    const storyId = await service.createStoryWithPacks(
      '01ARZ3NDEKTSV4RRFFQ69G5FUS',
      {
        userId: '01ARZ3NDEKTSV4RRFFQ69G5FUS',
        title: 'Applied',
        type: 'linear',
        description: null,
        genre: null,
        language: null,
        author: null,
        isFavorite: false,
        favoriteBehavior: 'individual',
        extraNotes: null,
        theme: null,
        timelineEpochDay: null,
        normalizeSceneTiming: false,
        allowReaderComments: false,
        autoLinkMentions: true,
        completenessChecks: false,
        statSystem: false,
        statNotation: 'letter',
        lastOperationLog: 0,
        lastServerSyncedLog: 0,
      },
      [packId],
    );

    const fields = (await database.db.query.storySchemaFields.findMany()).filter(
      (field) => field.storyId === storyId,
    );
    const suggestions = (await database.db.query.suggestions.findMany()).filter(
      (suggestion) => suggestion.storyId === storyId,
    );
    const customTypes = suggestions
      .map((suggestion) => suggestion.type)
      .filter((type) => type.startsWith('custom:'));

    expect(customTypes).toHaveLength(1);
    expect(customTypes[0]).toBe(`custom:${fields[0]?.id}`);
  });
});

/**
 * A downloaded pack is a local pack, with one difference: it was not extracted here, so it cannot be
 * re-extracted. Everything else about it - applying, conflicting, deleting - is the same.
 */
describe('packs from a server', () => {
  const remote = {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FRR',
    name: 'Downloaded',
    description: 'From somebody else',
    language: 'en',
    authorName: 'Someone',
    version: 3,
    visibility: 'private' as const,
    content: {
      formatVersion: 1,
      storySchemaFields: [],
      suggestions: [],
      tags: [],
      stats: [],
      statStrengths: [],
      settings: { statSystem: false, statNotation: 'letter' as const },
      extras: {
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
      },
    },
  };

  it('stores it with the remote id and no source story', async () => {
    const service = createPackService(database.db);
    await service.importRemotePack(remote);

    const [pack] = await service.listPacks();
    expect(pack).toMatchObject({
      id: remote.id,
      name: 'Downloaded',
      authorName: 'Someone',
      version: 3,
      sourceStoryId: null,
    });
  });

  it('replaces the copy already held rather than piling up a second one', async () => {
    const service = createPackService(database.db);
    await service.importRemotePack(remote);
    await service.importRemotePack({ ...remote, name: 'Downloaded again', version: 4 });

    const packs = await service.listPacks();
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({ name: 'Downloaded again', version: 4 });
  });

  it('can be applied like any other pack', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const source = await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'To share',
      selection: { ...ALL_OFF, tags: true },
    });
    const uploadable = await service.getPackForUpload(source);
    expect(uploadable).not.toBeNull();

    // The round trip a share performs: out of one device, into another.
    await service.deletePack(source);
    await service.importRemotePack({ ...uploadable!, id: remote.id });

    const storyId = await service.createStoryWithPacks(
      '01ARZ3NDEKTSV4RRFFQ69G5FUS',
      {
        userId: '01ARZ3NDEKTSV4RRFFQ69G5FUS',
        title: 'From a shared pack',
        type: 'linear',
        description: null,
        genre: null,
        language: null,
        author: null,
        isFavorite: false,
        favoriteBehavior: 'individual',
        extraNotes: null,
        theme: null,
        timelineEpochDay: null,
        normalizeSceneTiming: false,
        allowReaderComments: false,
        autoLinkMentions: true,
        completenessChecks: false,
        statSystem: false,
        statNotation: 'letter',
        lastOperationLog: 0,
        lastServerSyncedLog: 0,
      },
      [remote.id],
    );

    const tags = (await database.db.query.tags.findMany()).filter((tag) => tag.storyId === storyId);
    expect(tags).toHaveLength(1);
    expect(tags[0]?.name).toBe('Flashback');
  });

  it('gives back nothing for a pack that is not here', async () => {
    expect(
      await createPackService(database.db).getPackForUpload('01ARZ3NDEKTSV4RRFFQ69G5FZZ'),
    ).toBeNull();
  });

  it('tolerates a corrupt payload instead of breaking the listing or the upload', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await seedStructure();
    const service = createPackService(database.db);
    const packId = await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'Corrupt',
      selection: { ...ALL_OFF, tags: true },
    });
    await database.db
      .update(schema.packs)
      .set({ content: 'not-json{{{' })
      .where(eq(schema.packs.id, packId));

    // The listing shows the pack with empty counts; the upload refuses it quietly.
    const [listed] = await service.listPacks();
    expect(listed).toMatchObject({ id: packId, name: 'Corrupt' });
    expect(listed?.counts).toMatchObject({ tags: 0, stats: 0, suggestions: 0 });
    expect(await service.getPackForUpload(packId)).toBeNull();
    (console.error as jest.Mock).mockRestore();
  });

  it('renames a pack without touching its payload', async () => {
    await seedStructure();
    const service = createPackService(database.db);
    const packId = await service.createPack({
      sourceStoryId: TEST_STORY_ID,
      name: 'Before',
      selection: { ...ALL_OFF, tags: true },
    });
    const before = await database.db.query.packs.findFirst({
      where: eq(schema.packs.id, packId),
    });

    await service.updatePackDetails(packId, { name: 'After', description: 'new blurb' });

    const after = await database.db.query.packs.findFirst({
      where: eq(schema.packs.id, packId),
    });
    expect(after).toMatchObject({ name: 'After', description: 'new blurb' });
    expect(after?.content).toBe(before?.content);
  });
});
