/**
 * @jest-environment node
 */
import { createExampleStoryService } from '../../src/services/storymanagement/ExampleStoryService';
import { exampleStoryRegistry } from '../../src/exampleStories/generated/registry';
import { reviveDates } from '../../src/utils/reviveDates';
import { CURRENT_STORY_FORMAT_VERSION, FullStoryExportSchema } from '@keres/shared';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  (
    database.db as unknown as {
      transaction: <T>(callback: (tx: typeof database.db) => Promise<T>) => Promise<T>;
    }
  ).transaction = async (callback) => callback(database.db);
});

afterEach(() => database.close());

it('exposes the bundled example catalog and rejects an unknown slug-language pair', async () => {
  const service = createExampleStoryService(database.db);
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  expect(service.listExampleStories().length).toBeGreaterThan(0);
  await expect(
    service.installExampleStory('local-user', 'missing-example', 'pt-BR'),
  ).resolves.toEqual({
    status: 'not_found',
  });
  errorSpy.mockRestore();
});

it('ships every public-domain example at format v4 with the current local features', () => {
  for (const entry of exampleStoryRegistry) {
    for (const language of entry.languages) {
      const parsed = FullStoryExportSchema.safeParse(reviveDates(language.story));

      expect(parsed.success).toBe(true);
      if (!parsed.success) continue;

      expect(parsed.data.formatVersion).toBe(CURRENT_STORY_FORMAT_VERSION);
      expect(parsed.data.comments).toHaveLength(1);
      expect(parsed.data.seeAlsoRelations).toHaveLength(1);
      expect(parsed.data.favorites).toHaveLength(1);
      expect(parsed.data.choiceCheckGroups).toHaveLength(parsed.data.choices.length ? 1 : 0);
      expect(parsed.data.choiceChecks).toHaveLength(parsed.data.choices.length ? 1 : 0);
      expect(parsed.data.effects).toHaveLength(1);
      expect(parsed.data.attributeValues).toHaveLength(4);
      expect(parsed.data.locationRelations).toHaveLength(1);
    }
  }
});

it('installs the same bundled example as independent local copies', async () => {
  const service = createExampleStoryService(database.db);

  const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
  const first = await service.installExampleStory(userId, 'alice-in-wonderland', 'en');
  const second = await service.installExampleStory(userId, 'alice-in-wonderland', 'en');

  expect(first).toMatchObject({ status: 'installed' });
  expect(second).toMatchObject({ status: 'installed' });
  if (first.status !== 'installed' || second.status !== 'installed') return;

  expect(first.storyId).not.toBe(second.storyId);
  expect((await database.db.query.stories.findMany()).map((story) => story.id)).toEqual(
    expect.arrayContaining([first.storyId, second.storyId]),
  );
});
