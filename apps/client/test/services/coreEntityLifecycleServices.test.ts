/**
 * @jest-environment node
 */
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createCharacterRelationService } from '../../src/services/storymanagement/CharacterRelationService';
import { createItemService } from '../../src/services/storymanagement/ItemService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('core narrative entity write lifecycles', () => {
  it('creates, updates, and tombstones a chapter while recording each meaningful change', async () => {
    const service = createChapterService(database.db);
    const chapter = await service.createChapter(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Ato I',
      index: 1,
    });
    const updated = await service.updateChapter(TEST_USER_ID, chapter.id, { name: 'Ato Um' });
    await service.deleteChapter(TEST_USER_ID, chapter.id);

    expect(updated).toMatchObject({ name: 'Ato Um', version: 2 });
    expect(await service.getById(chapter.id)).toBeUndefined();
    expect(
      await database.db
        .select()
        .from(schema.operationLogs)
        .where(eq(schema.operationLogs.entityId, chapter.id))
        .all(),
    ).toHaveLength(3);
  });

  it('persists a scene lifecycle with its narrative placement', async () => {
    const service = createSceneService(database.db);
    const scene = await service.createScene(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      chapterId: 'chapter-1',
      locationId: 'location-1',
      name: 'Chegada',
      index: 1,
    });
    const updated = await service.updateScene(TEST_USER_ID, scene.id, {
      name: 'Chegada ao porto',
    });
    await service.deleteScene(TEST_USER_ID, scene.id);

    expect(updated).toMatchObject({ name: 'Chegada ao porto', version: 2 });
    expect(await service.getById(scene.id)).toBeUndefined();
  });

  it('keeps an item out of normal reads after its delete operation', async () => {
    const service = createItemService(database.db);
    const item = await service.createItem(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Bússola',
    });
    const updated = await service.updateItem(TEST_USER_ID, item.id, { name: 'Bússola dourada' });
    await service.deleteItem(TEST_USER_ID, item.id);

    expect(updated).toMatchObject({ name: 'Bússola dourada', version: 2 });
    expect(await service.getById(item.id)).toBeUndefined();
  });

  it('prevents a duplicate character pair and tombstones the accepted relation', async () => {
    const service = createCharacterRelationService(database.db);
    const relation: CharacterRelation = {
      id: '',
      storyId: TEST_STORY_ID,
      charId1: 'character-a',
      charId2: 'character-b',
      relationType: 'mentor',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };
    const created = await service.saveCharacterRelation(TEST_USER_ID, relation);

    await expect(service.saveCharacterRelation(TEST_USER_ID, relation)).rejects.toThrow(
      /already exists/,
    );
    expect(await service.deleteCharacterRelation(TEST_USER_ID, created.id)).toBe(true);
    expect(await service.getRelationsForCharacter(TEST_STORY_ID, 'character-a')).toEqual([]);
  });
});
