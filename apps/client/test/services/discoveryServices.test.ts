/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createGlobalSearchService } from '../../src/services/storymanagement/GlobalSearchService';
import { createStoryAnalysisService } from '../../src/services/storymanagement/StoryAnalysisService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

afterEach(() => database.close());

describe('discovery services', () => {
  it('does not search a one-character term and returns live native matches with a useful snippet', async () => {
    await database.db.insert(schema.characters).values([
      { id: 'ada', storyId: TEST_STORY_ID, name: 'Ada Lovelace', ...entityBase },
      {
        id: 'deleted-ada',
        storyId: TEST_STORY_ID,
        name: 'Ada Oculta',
        ...entityBase,
        isDeleted: true,
      },
    ]);
    const service = createGlobalSearchService(database.db);

    expect(await service.searchAllEntities(TEST_STORY_ID, 'a', TEST_USER_ID)).toEqual([]);
    expect(await service.searchAllEntities(TEST_STORY_ID, 'LOVE', TEST_USER_ID)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'Character',
          id: 'ada',
          title: 'Ada Lovelace',
          snippet: expect.stringContaining('Ada Lovelace'),
        }),
      ]),
    );
  });

  it('turns the data loaded by StoryAnalysisService into structural findings', async () => {
    await database.db.insert(schema.characters).values({
      id: 'isolated',
      storyId: TEST_STORY_ID,
      name: 'Personagem isolado',
      ...entityBase,
    });

    const report = await createStoryAnalysisService(database.db).analyzeStory(TEST_STORY_ID);
    expect(report.generatedAt).toBeInstanceOf(Date);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: 'isolated',
          messageKey: 'analysis_character_no_scenes',
        }),
        expect.objectContaining({
          entityId: 'isolated',
          messageKey: 'analysis_character_no_relationships',
        }),
      ]),
    );
  });
});
