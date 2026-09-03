/** @jest-environment node */
jest.mock('../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: { deleteStoryMedia: jest.fn() },
}));

import { AttributeType } from '@keres/shared';
import { FullStoryExportSchema } from '@keres/shared';
import * as schema from '../../src/db/schema';
import { mediaFileService } from '../../src/services/MediaFileService';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { entityBase, seedLocalStory } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;
const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const AUTHOR_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
const LOCAL_USER_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
const CHARACTER_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAZ';
const DELETED_CHARACTER_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const RELATION_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB1';
const FIELD_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB2';
const VALUE_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB3';
const GALLERY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB4';
const COMMENT_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB5';
const LINK_GALLERY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB6';

beforeEach(async () => {
  jest.clearAllMocks();
  database = await createTestDatabase();
  await seedLocalStory(database, { id: STORY_ID, userId: AUTHOR_ID });
});

afterEach(() => database.close());

it('round-trips portable story data after a permanent local purge and clears stale child rows first', async () => {
  await database.db.insert(schema.characters).values([
    { id: CHARACTER_ID, storyId: STORY_ID, name: 'Ariane', ...entityBase },
    {
      id: DELETED_CHARACTER_ID,
      storyId: STORY_ID,
      name: 'Antiga',
      ...entityBase,
      isDeleted: true,
    },
  ]);
  await database.db.insert(schema.characterRelations).values({
    id: RELATION_ID,
    storyId: STORY_ID,
    character1Id: CHARACTER_ID,
    character2Id: DELETED_CHARACTER_ID,
    relationType: 'mentor',
    ...entityBase,
  });
  await database.db.insert(schema.storySchemaFields).values({
    id: FIELD_ID,
    storyId: STORY_ID,
    entityType: 'Character',
    name: 'Poder',
    key: 'power',
    type: AttributeType.TEXT,
    order: 0,
    ...entityBase,
  });
  await database.db.insert(schema.attributeValues).values({
    id: VALUE_ID,
    storyId: STORY_ID,
    entityType: 'Character',
    entityId: CHARACTER_ID,
    fieldId: FIELD_ID,
    value: 'Luz',
    ...entityBase,
  });
  await database.db.insert(schema.galleries).values({
    id: GALLERY_ID,
    storyId: STORY_ID,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'mapa.png',
    hash: '0123456789abcdef0123456789abcdef',
    sizeBytes: 3,
    ...entityBase,
  });
  await database.db.insert(schema.galleries).values({
    id: LINK_GALLERY_ID,
    storyId: STORY_ID,
    mediaType: 'link',
    mimeType: 'text/uri-list',
    fileName: 'Referência',
    hash: 'fedcba9876543210fedcba9876543210',
    sizeBytes: 0,
    sourceUrl: 'https://example.com/reference',
    ...entityBase,
  });
  await database.db.insert(schema.comments).values({
    id: COMMENT_ID,
    storyId: STORY_ID,
    entityType: 'Character',
    entityId: CHARACTER_ID,
    fieldKey: 'name',
    authorUserId: AUTHOR_ID,
    commentText: 'Rever nome',
    criticality: 1,
    ...entityBase,
  });

  // better-sqlite3 transactions are synchronous, while the production expo-sqlite driver's
  // transaction awaits this service's async callback. Keep the real in-memory tables, but give
  // this integration test the production callback semantics.
  (
    database.db as unknown as {
      transaction: <T>(callback: (tx: typeof database.db) => Promise<T>) => Promise<T>;
    }
  ).transaction = async (callback) => callback(database.db);

  const service = createStoryService(database.db);
  const exported = await service.exportFullStory(STORY_ID);
  expect(exported.characters.map((character) => character.id)).toEqual([CHARACTER_ID]);
  // The relation's other end is a soft-deleted character, which the export leaves out - so the
  // relation goes with it. It used to travel inside the package and re-import as a link to nothing,
  // which is why the relation graph learned to skip edges whose ends it cannot find.
  expect(exported.characterRelations).toEqual([]);
  expect(exported.attributeValues).toEqual([expect.objectContaining({ fieldId: FIELD_ID })]);

  await service.deleteStory(STORY_ID);
  expect(await service.getStoryById(STORY_ID)).toBeUndefined();
  expect(await database.db.query.characters.findMany()).toEqual([]);
  expect(await database.db.query.storySchemaFields.findMany()).toEqual([]);
  expect(mediaFileService.deleteStoryMedia).toHaveBeenCalledWith(STORY_ID);

  // Simulates an interrupted old import: this row would collide on its id/key without the
  // defensive child-table cleanup at the beginning of importFullStory.
  await database.db.insert(schema.storySchemaFields).values({
    id: FIELD_ID,
    storyId: STORY_ID,
    entityType: 'Character',
    name: 'Obsoleto',
    key: 'power',
    type: AttributeType.TEXT,
    order: 0,
    ...entityBase,
  });

  const importedStoryId = await service.importFullStory(
    LOCAL_USER_ID,
    exported,
    null,
    null,
    new Map([['0123456789abcdef0123456789abcdef', 'desktop-media:media/mapa.png']]),
  );

  expect(importedStoryId).not.toBe(STORY_ID);
  expect(await service.getStoryById(STORY_ID)).toBeUndefined();
  expect(await service.getStoryById(importedStoryId)).toEqual(
    expect.objectContaining({ userId: LOCAL_USER_ID, serverId: null }),
  );
  const importedField = (await database.db.query.storySchemaFields.findMany()).find(
    (field) => field.storyId === importedStoryId,
  );
  const importedValue = (await database.db.query.attributeValues.findMany()).find(
    (value) => value.storyId === importedStoryId,
  );
  const importedCharacter = (await database.db.query.characters.findMany()).find(
    (character) => character.storyId === importedStoryId,
  );
  expect(importedField).toEqual(
    expect.objectContaining({ storyId: importedStoryId, name: 'Poder' }),
  );
  expect(importedField?.id).not.toBe(FIELD_ID);
  expect(importedValue).toEqual(
    expect.objectContaining({ storyId: importedStoryId, fieldId: importedField?.id, value: 'Luz' }),
  );
  expect(importedValue?.id).not.toBe(VALUE_ID);
  expect(importedCharacter?.id).not.toBe(CHARACTER_ID);
  const importedGalleries = await database.db.query.galleries.findMany({
    where: (gallery, { eq: equals }) => equals(gallery.storyId, importedStoryId),
  });
  expect(importedGalleries.find((gallery) => gallery.mediaType === 'image')).toEqual(
    expect.objectContaining({
      storyId: importedStoryId,
      localPath: 'desktop-media:media/mapa.png',
      uploadState: 'pending',
      downloadState: 'downloaded',
    }),
  );
  expect(importedGalleries.find((gallery) => gallery.mediaType === 'link')).toEqual(
    expect.objectContaining({
      storyId: importedStoryId,
      localPath: null,
      uploadState: 'uploaded',
      downloadState: 'downloaded',
    }),
  );
  expect(await database.db.query.comments.findFirst()).toEqual(
    expect.objectContaining({ storyId: importedStoryId, authorUserId: LOCAL_USER_ID }),
  );
});

/**
 * The device's export did not carry the choices' conditions and effects: the importer here always knew
 * how to read them and the API always exported them, but whoever generated the package in the app sent
 * the story without the choices' logic - and with no error, because the three fields are optional in
 * the schema.
 */
it('exports the choices checks, check groups and effects', async () => {
  const SCENE_ID = '01ARZ3NDEKTSV4RRFFQ69G5FC0';
  const CHAPTER_ID = '01ARZ3NDEKTSV4RRFFQ69G5FC1';
  const LOCATION_ID = '01ARZ3NDEKTSV4RRFFQ69G5FC2';
  const CHOICE_ID = '01ARZ3NDEKTSV4RRFFQ69G5FC3';
  const GROUP_ID = '01ARZ3NDEKTSV4RRFFQ69G5FC4';
  const CHECK_ID = '01ARZ3NDEKTSV4RRFFQ69G5FC5';
  const EFFECT_ID = '01ARZ3NDEKTSV4RRFFQ69G5FC6';

  await database.db
    .insert(schema.chapters)
    .values({ id: CHAPTER_ID, storyId: STORY_ID, name: 'Um', index: 1, ...entityBase });
  await database.db
    .insert(schema.locations)
    .values({ id: LOCATION_ID, storyId: STORY_ID, name: 'Praça', ...entityBase });
  await database.db.insert(schema.scenes).values({
    id: SCENE_ID,
    storyId: STORY_ID,
    chapterId: CHAPTER_ID,
    locationId: LOCATION_ID,
    name: 'Encontro',
    index: 1,
    ...entityBase,
  });
  await database.db.insert(schema.choices).values({
    id: CHOICE_ID,
    storyId: STORY_ID,
    sceneId: SCENE_ID,
    nextSceneId: SCENE_ID,
    text: 'Seguir',
    ...entityBase,
  });
  await database.db.insert(schema.choiceCheckGroups).values({
    id: GROUP_ID,
    storyId: STORY_ID,
    choiceId: CHOICE_ID,
    combinator: 'AND',
    order: 1,
    ...entityBase,
  });
  await database.db.insert(schema.choiceChecks).values({
    id: CHECK_ID,
    storyId: STORY_ID,
    groupId: GROUP_ID,
    mode: 'block',
    type: 'trigger',
    order: 1,
    triggerName: 'porta_aberta',
    triggerState: 'set',
    ...entityBase,
  });
  await database.db.insert(schema.effects).values({
    id: EFFECT_ID,
    storyId: STORY_ID,
    entityType: 'Choice',
    entityId: CHOICE_ID,
    effectType: 'triggerSet',
    triggerName: 'porta_aberta',
    ...entityBase,
  });

  const exported = await createStoryService(database.db).exportFullStory(STORY_ID);

  expect(exported.choiceCheckGroups?.map((group) => group.id)).toEqual([GROUP_ID]);
  expect(exported.choiceChecks?.map((check) => check.id)).toEqual([CHECK_ID]);
  expect(exported.effects?.map((effect) => effect.id)).toEqual([EFFECT_ID]);
});

/**
 * A structural guard: every entity the format knows about has to come out in the export, even as an
 * empty list. A new entity forgotten here breaks nothing visible - the package merely comes out
 * incomplete, and the loss shows up weeks later, on the way back in.
 */
it('exports one list for every entity the export format knows about', async () => {
  const exported = await createStoryService(database.db).exportFullStory(STORY_ID);

  const missing = Object.keys(FullStoryExportSchema.shape).filter(
    (key) => !(key in (exported as Record<string, unknown>)),
  );

  expect(missing).toEqual([]);
});

/**
 * The importer inserts row by row, with no checks, and local SQLite has always been more permissive
 * than the server's PostgreSQL. A package carrying the same character relation twice used to install
 * cleanly and only fail much later, on a synchronization - after the writer had already seen the pair
 * drawn twice on the relation graph.
 */
it('refuses a package whose rows contradict one another', async () => {
  await database.db.insert(schema.characters).values([
    { id: CHARACTER_ID, storyId: STORY_ID, name: 'Ariane', ...entityBase },
    { id: DELETED_CHARACTER_ID, storyId: STORY_ID, name: 'Belmiro', ...entityBase },
  ]);
  (
    database.db as unknown as {
      transaction: <T>(callback: (tx: typeof database.db) => Promise<T>) => Promise<T>;
    }
  ).transaction = async (callback) => callback(database.db);

  const service = createStoryService(database.db);
  const exported = await service.exportFullStory(STORY_ID);
  const relation = {
    storyId: STORY_ID,
    character1Id: CHARACTER_ID,
    character2Id: DELETED_CHARACTER_ID,
    relationType: 'mentor',
    ...entityBase,
  };
  const corrupt = {
    ...exported,
    // Reversed, not repeated: this is the pair the server's unique constraint on the ordered pair
    // does not see either.
    characterRelations: [
      { ...relation, id: RELATION_ID },
      {
        ...relation,
        id: `${RELATION_ID.slice(0, -1)}2`,
        character1Id: DELETED_CHARACTER_ID,
        character2Id: CHARACTER_ID,
      },
    ],
  } as typeof exported;

  await expect(service.importFullStory(LOCAL_USER_ID, corrupt, null)).rejects.toThrow(
    /characterRelations/,
  );
  expect(
    (await database.db.query.stories.findMany()).filter((story) => story.id !== STORY_ID),
  ).toEqual([]);
});
