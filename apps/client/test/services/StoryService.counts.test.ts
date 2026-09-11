/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import * as schema from '../../src/db/schema';
import { createStoryContentMetricsService } from '../../src/services/storymanagement/StoryContentMetricsService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

afterEach(() => database.close());

it('counts only live stories and entities in the requested story', async () => {
  await database.db.insert(schema.stories).values([
    {
      id: 'branching-story',
      userId: 'local-user',
      title: 'Ramos',
      type: 'branching',
      favoriteBehavior: 'individual',
      ...entityBase,
    },
    {
      id: 'deleted-story',
      userId: 'local-user',
      title: 'Removida',
      type: 'branching',
      favoriteBehavior: 'individual',
      ...entityBase,
      isDeleted: true,
    },
  ]);
  await database.db.insert(schema.characters).values([
    { id: 'live', storyId: TEST_STORY_ID, name: 'Vivo', ...entityBase },
    {
      id: 'deleted',
      storyId: TEST_STORY_ID,
      name: 'Removido',
      ...entityBase,
      isDeleted: true,
    },
  ]);

  const service = createStoryContentMetricsService(database.db);
  expect(await service.getCatalogCounts()).toEqual({ totalStories: 2, branchingStories: 1 });
  await expect(service.getContentCounts(TEST_STORY_ID)).resolves.toMatchObject({
    characterCount: 1,
  });
});

it('keeps every dashboard count scoped to live entities and identifies real branching forks', async () => {
  const forkStoryId = 'fork-story';
  await database.db.insert(schema.stories).values({
    id: forkStoryId,
    userId: 'local-user',
    title: 'Ramos',
    type: 'branching',
    favoriteBehavior: 'individual',
    ...entityBase,
  });
  await database.db.insert(schema.locations).values({
    id: 'location-1',
    storyId: TEST_STORY_ID,
    name: 'Torre',
    ...entityBase,
  });
  await database.db.insert(schema.chapters).values({
    id: 'chapter-1',
    storyId: TEST_STORY_ID,
    name: 'Ato I',
    index: 0,
    ...entityBase,
  });
  await database.db.insert(schema.scenes).values([
    {
      id: 'scene-1',
      storyId: TEST_STORY_ID,
      chapterId: 'chapter-1',
      locationId: 'location-1',
      name: 'Chegada',
      index: 0,
      ...entityBase,
    },
    {
      id: 'fork-source',
      storyId: forkStoryId,
      chapterId: 'fork-chapter',
      locationId: 'fork-location',
      name: 'Escolha',
      index: 0,
      ...entityBase,
    },
    {
      id: 'fork-left',
      storyId: forkStoryId,
      chapterId: 'fork-chapter',
      locationId: 'fork-location',
      name: 'Esquerda',
      index: 1,
      ...entityBase,
    },
    {
      id: 'fork-right',
      storyId: forkStoryId,
      chapterId: 'fork-chapter',
      locationId: 'fork-location',
      name: 'Direita',
      index: 2,
      ...entityBase,
    },
  ]);
  await database.db.insert(schema.choices).values([
    {
      id: 'choice-1',
      storyId: TEST_STORY_ID,
      sceneId: 'scene-1',
      nextSceneId: 'scene-1',
      text: 'Continuar',
      ...entityBase,
    },
    {
      id: 'fork-choice-left',
      storyId: forkStoryId,
      sceneId: 'fork-source',
      nextSceneId: 'fork-left',
      text: 'Ir à esquerda',
      ...entityBase,
    },
    {
      id: 'fork-choice-right',
      storyId: forkStoryId,
      sceneId: 'fork-source',
      nextSceneId: 'fork-right',
      text: 'Ir à direita',
      ...entityBase,
    },
  ]);
  await database.db.insert(schema.notes).values({
    id: 'note-1',
    storyId: TEST_STORY_ID,
    title: 'Lembrete',
    ...entityBase,
  });
  await database.db.insert(schema.worldRules).values({
    id: 'rule-1',
    storyId: TEST_STORY_ID,
    title: 'Magia custa caro',
    ...entityBase,
  });
  await database.db.insert(schema.items).values({
    id: 'item-1',
    storyId: TEST_STORY_ID,
    name: 'Chave',
    ...entityBase,
  });
  await database.db.insert(schema.galleries).values({
    id: 'gallery-1',
    storyId: TEST_STORY_ID,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'mapa.png',
    hash: '0123456789abcdef0123456789abcdef',
    sizeBytes: 4,
    ...entityBase,
  });
  await database.db.insert(schema.tags).values({
    id: 'tag-1',
    storyId: TEST_STORY_ID,
    name: 'Importante',
    ...entityBase,
  });
  await database.db.insert(schema.storySchemaFields).values({
    id: 'field-1',
    storyId: TEST_STORY_ID,
    entityType: 'Character',
    name: 'Origem',
    key: 'origin',
    type: AttributeType.TEXT,
    order: 0,
    ...entityBase,
  });

  const service = createStoryContentMetricsService(database.db);
  await expect(service.getContentCounts(TEST_STORY_ID)).resolves.toEqual({
    characterCount: 0,
    choiceCount: 1,
    locationCount: 1,
    chapterCount: 1,
    sceneCount: 1,
    noteCount: 1,
    worldRuleCount: 1,
    itemCount: 1,
    galleryCount: 1,
    tagCount: 1,
    customAttributeCount: 1,
    branchingStoryForkCount: 0,
  });
  await expect(service.getContentCounts()).resolves.toEqual({
    characterCount: 0,
    choiceCount: 3,
    locationCount: 1,
    chapterCount: 1,
    sceneCount: 4,
    noteCount: 1,
    worldRuleCount: 1,
    itemCount: 1,
    galleryCount: 1,
    tagCount: 1,
    customAttributeCount: 1,
    branchingStoryForkCount: 1,
  });
  await expect(service.getContentCounts(forkStoryId)).resolves.toMatchObject({
    branchingStoryForkCount: 1,
  });
});
