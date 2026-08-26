/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createPackService } from '../../src/services/storymanagement/PackService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * A pack is the *shape* of a story, never its content.
 *
 * Most of these assertions are about what must NOT come along: an entity, an attribute value, a
 * character's stat. A pack that carried those would be a story, and the feature's whole promise -
 * apply at creation, zero operations, bootstrap to the server whole - rests on it staying small.
 */

let database: TestDatabase;

const ALL_OFF = {
  customAttributes: false,
  suggestions: false,
  suggestionsIncludeUsed: false,
  stats: false,
  tags: false,
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
    });

    // The pack's shape is fixed by the schema: there is nowhere for a character or a stat value to go.
    expect(Object.keys(content).sort()).toEqual(
      [
        'formatVersion',
        'settings',
        'statStrengths',
        'stats',
        'storySchemaFields',
        'suggestions',
        'tags',
      ].sort(),
    );
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
      },
    });

    const [pack] = await service.listPacks();
    expect(pack?.counts).toEqual({ customAttributes: 1, suggestions: 1, tags: 1, stats: 1 });
    expect(pack?.version).toBe(1);
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
    normalizeSceneTiming: false,
    allowReaderComments: false,
    autoLinkMentions: true,
    completenessChecks: false,
    statSystem: false,
    statNotation: 'letter' as const,
    lastOperationLog: 0,
    lastServerSyncedLog: 0,
  };

  async function packFrom(selection: Partial<typeof ALL_OFF> = {}) {
    return createPackService(database.db).createPack({
      sourceStoryId: TEST_STORY_ID,
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
});
