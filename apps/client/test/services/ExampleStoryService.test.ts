/**
 * @jest-environment node
 */
import { createExampleStoryService } from '../../src/services/storymanagement/ExampleStoryService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
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
