/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import * as schema from '../../src/db/schema';
import { createStorySchemaFieldService } from '../../src/services/storymanagement/StorySchemaFieldService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The custom-attribute field service's update path and delete edges.
 *
 * Field creation (with the duplicate-key guard) and the value cascade on delete already live in
 * `storyManagementRelations.test.ts`. What was missing is the update itself - labels and help text
 * are the most-edited columns of the whole schema - and the two quiet delete edges: an unknown id
 * (a stale form) and an already-tombstoned field (an idempotent resend, where the key mangling
 * and the value cascade must not run twice).
 *
 * Two throws are deliberately not covered: the "the write returned no row" guards in
 * `updateField`/`deleteField`, which need the row to vanish between two statements of the same
 * call.
 */

let database: TestDatabase;

const seedField = async (id: string, key = 'rank'): Promise<void> => {
  await database.db.insert(schema.storySchemaFields).values({
    id,
    storyId: TEST_STORY_ID,
    entityType: 'Character',
    name: 'Rank',
    key,
    type: AttributeType.TEXT,
    isRequired: false,
    order: 0,
    ...entityBase,
    deletedAt: null,
  });
};

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('StorySchemaFieldService update', () => {
  it('renames a field and logs the change with the new version', async () => {
    const service = createStorySchemaFieldService(database.db);
    await seedField('f-rank');

    await service.updateField(TEST_USER_ID, 'f-rank', {
      name: 'Military rank',
      description: 'Shown on the sheet header',
    });

    const stored = await service.getById('f-rank');
    expect(stored).toMatchObject({
      name: 'Military rank',
      description: 'Shown on the sheet header',
      version: 2,
    });
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      entityType: 'StorySchemaField',
      operationType: 'update',
    });
  });

  it('refuses to update a field that does not exist', async () => {
    const service = createStorySchemaFieldService(database.db);

    await expect(service.updateField(TEST_USER_ID, 'missing', { name: 'X' })).rejects.toThrow(
      'not found for update',
    );
  });
});

describe('StorySchemaFieldService delete edges', () => {
  it('warns and stays quiet on an unknown id', async () => {
    const service = createStorySchemaFieldService(database.db);

    await service.deleteField(TEST_USER_ID, 'missing');

    expect(console.warn).toHaveBeenCalledWith(
      'Attempted to delete non-existent attribute field missing.',
    );
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });

  it('does not run the cascade twice for an already-deleted field', async () => {
    const service = createStorySchemaFieldService(database.db);
    await seedField('f-rank');
    await service.deleteField(TEST_USER_ID, 'f-rank');
    const before = await database.db.query.operationLogs.findMany();

    await service.deleteField(TEST_USER_ID, 'f-rank');

    expect(await database.db.query.operationLogs.findMany()).toHaveLength(before.length);
  });

  it('frees the key slot so the field can be recreated after deletion', async () => {
    const service = createStorySchemaFieldService(database.db);
    await seedField('f-rank', 'rank');

    await service.deleteField(TEST_USER_ID, 'f-rank');
    const recreated = await service.createField(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      name: 'Rank again',
      key: 'rank',
      type: AttributeType.TEXT,
      isRequired: false,
      order: 0,
    });

    expect(recreated.key).toBe('rank');
  });
});
