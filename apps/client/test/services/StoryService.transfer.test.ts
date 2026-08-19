/** @jest-environment node */
jest.mock('../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: { deleteStoryMedia: jest.fn() },
}));

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
    type: 'text',
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
  expect(exported.characterRelations).toEqual([
    expect.objectContaining({ character1Id: CHARACTER_ID, character2Id: DELETED_CHARACTER_ID }),
  ]);
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
    type: 'text',
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
  expect(await database.db.query.galleries.findFirst()).toEqual(
    expect.objectContaining({
      storyId: importedStoryId,
      localPath: 'desktop-media:media/mapa.png',
      uploadState: 'pending',
      downloadState: 'downloaded',
    }),
  );
  expect(await database.db.query.comments.findFirst()).toEqual(
    expect.objectContaining({ storyId: importedStoryId, authorUserId: LOCAL_USER_ID }),
  );
});
