/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { AttributeType } from '@keres/shared';
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

  it('shows a suggestion list in the snippet as a comma-separated line, not JSON', async () => {
    await database.db.insert(schema.characters).values({
      id: 'listed',
      storyId: TEST_STORY_ID,
      name: 'Lista Viva',
      ...entityBase,
    });
    await database.db.insert(schema.storySchemaFields).values({
      id: 'traits',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      name: 'Traços',
      key: 'tracos',
      type: AttributeType.SUGGESTION_LIST,
      isRequired: false,
      order: 0,
      ...entityBase,
    });
    await database.db.insert(schema.attributeValues).values({
      id: 'listed-traits',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      entityId: 'listed',
      fieldId: 'traits',
      value: '["elf","dwarf"]',
      ...entityBase,
    });

    const matches = await createGlobalSearchService(database.db).searchAllEntities(
      TEST_STORY_ID,
      'elf',
      TEST_USER_ID,
    );

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'listed',
          snippet: expect.stringContaining('Traços: elf, dwarf'),
        }),
      ]),
    );
    expect(matches.find((match) => match.id === 'listed')?.snippet).not.toContain('[');
  });

  it('turns the data loaded by StoryAnalysisService into structural findings', async () => {
    await database.db.insert(schema.characters).values({
      id: 'isolated',
      storyId: TEST_STORY_ID,
      name: 'Personagem isolado',
      ...entityBase,
    });
    // "Not referenced anywhere" is an opinion, so it is behind the story's own switch. Turning it on
    // here is also what proves the column reaches the checks - the flag travels from this row into
    // `StoryAnalysisInput`, not from a default in the code.
    await database.db
      .update(schema.stories)
      .set({ completenessChecks: true })
      .where(eq(schema.stories.id, TEST_STORY_ID));

    const report = await createStoryAnalysisService(database.db).analyzeStoryFull(TEST_STORY_ID);
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
