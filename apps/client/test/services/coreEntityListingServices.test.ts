/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createCharacterService } from '../../src/services/storymanagement/CharacterService';
import { createItemService } from '../../src/services/storymanagement/ItemService';
import { createLocationService } from '../../src/services/storymanagement/LocationService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

afterEach(() => database.close());

describe('core entity listing services', () => {
  it('filters CharacterService by a case-insensitive search and favorite state', async () => {
    await database.db.insert(schema.characters).values([
      {
        id: 'ada',
        storyId: TEST_STORY_ID,
        name: 'Ada',
        title: 'Analista',
        isFavorite: true,
        ...entityBase,
      },
      { id: 'grace', storyId: TEST_STORY_ID, name: 'Grace', isFavorite: false, ...entityBase },
    ]);
    const service = createCharacterService(database.db);

    expect(
      (await service.getCharactersByStoryId(TEST_STORY_ID, 'anal')).map((row) => row.id),
    ).toEqual(['ada']);
    expect(
      (await service.getCharactersByStoryId(TEST_STORY_ID, undefined, undefined, 'favorite')).map(
        (row) => row.id,
      ),
    ).toEqual(['ada']);
  });

  it('filters LocationService by a searchable description and excludes non-favorites', async () => {
    await database.db.insert(schema.locations).values([
      {
        id: 'city',
        storyId: TEST_STORY_ID,
        name: 'Cidade',
        description: 'Porto antigo',
        isFavorite: true,
        ...entityBase,
      },
      {
        id: 'forest',
        storyId: TEST_STORY_ID,
        name: 'Floresta',
        description: 'Neblina',
        isFavorite: false,
        ...entityBase,
      },
    ]);
    const service = createLocationService(database.db);

    expect(
      (await service.getLocationsByStoryId(TEST_STORY_ID, 'PORTO')).map((row) => row.id),
    ).toEqual(['city']);
    expect(
      (
        await service.getLocationsByStoryId(TEST_STORY_ID, undefined, undefined, 'not-favorite')
      ).map((row) => row.id),
    ).toEqual(['forest']);
  });

  it('orders ChapterService by its narrative index by default', async () => {
    await database.db.insert(schema.chapters).values([
      { id: 'second', storyId: TEST_STORY_ID, name: 'Segundo', index: 2, ...entityBase },
      { id: 'first', storyId: TEST_STORY_ID, name: 'Primeiro', index: 1, ...entityBase },
    ]);

    expect(
      (await createChapterService(database.db).getChaptersByStoryId(TEST_STORY_ID)).map(
        (row) => row.id,
      ),
    ).toEqual(['first', 'second']);
  });

  it('finds SceneService neighbors inside the same chapter', async () => {
    await database.db.insert(schema.scenes).values([
      {
        id: 'one',
        storyId: TEST_STORY_ID,
        chapterId: 'chapter',
        locationId: 'city',
        name: 'Um',
        index: 1,
        ...entityBase,
      },
      {
        id: 'two',
        storyId: TEST_STORY_ID,
        chapterId: 'chapter',
        locationId: 'city',
        name: 'Dois',
        index: 2,
        ...entityBase,
      },
      {
        id: 'three',
        storyId: TEST_STORY_ID,
        chapterId: 'chapter',
        locationId: 'city',
        name: 'Três',
        index: 3,
        ...entityBase,
      },
    ]);

    const neighbors = await createSceneService(database.db).getPreviousNextScenes(
      TEST_STORY_ID,
      'two',
      'chapter',
    );
    expect(neighbors.previousScene?.id).toBe('one');
    expect(neighbors.nextScene?.id).toBe('three');
  });

  it('honors ItemService’s singular favorite filter emitted by the UI', async () => {
    await database.db.insert(schema.items).values([
      { id: 'sword', storyId: TEST_STORY_ID, name: 'Espada', isFavorite: true, ...entityBase },
      { id: 'rope', storyId: TEST_STORY_ID, name: 'Corda', isFavorite: false, ...entityBase },
    ]);

    expect(
      (
        await createItemService(database.db).getItemsByStoryId(
          TEST_STORY_ID,
          undefined,
          null,
          undefined,
          'favorite',
        )
      ).map((row) => row.id),
    ).toEqual(['sword']);
  });
});
