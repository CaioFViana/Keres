/**
 * @jest-environment node
 */
import { and, eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { softDeleteRowSync } from '../../src/services/storymanagement/softDelete';
import { runLocalWrite } from '../../src/utils/syncUtils';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.items).values({
    id: 'item-1',
    storyId: TEST_STORY_ID,
    name: 'Brass compass',
    ...entityBase,
    deletedAt: null,
  });
});

afterEach(() => {
  database.close();
});

describe('softDeleteRowSync', () => {
  it('marks the row deleted with the next version, and records the delete peers apply', async () => {
    const deleted = await runLocalWrite(database.db, TEST_STORY_ID, () =>
      softDeleteRowSync(database.db, schema.items, 'Item', 'item-1', TEST_USER_ID),
    );

    expect(deleted).toEqual({ id: 'item-1', storyId: TEST_STORY_ID, isDeleted: true, version: 2 });
    const row = database.db.select().from(schema.items).where(eq(schema.items.id, 'item-1')).get();
    expect(row).toMatchObject({ isDeleted: true, version: 2 });
    expect(row?.deletedAt).toBeInstanceOf(Date);

    const [operation] = database.db
      .select()
      .from(schema.operationLogs)
      .where(
        and(
          eq(schema.operationLogs.entityId, 'item-1'),
          eq(schema.operationLogs.entityType, 'Item'),
        ),
      )
      .all();
    expect(operation.operationType).toBe('delete');
    expect(JSON.parse(operation.payload as string)).toEqual({
      id: 'item-1',
      isDeleted: true,
      version: 2,
    });
  });

  it('refuses a row that is not there, and the write unit leaves nothing behind', async () => {
    await expect(
      runLocalWrite(database.db, TEST_STORY_ID, () =>
        softDeleteRowSync(database.db, schema.items, 'Item', 'missing', TEST_USER_ID),
      ),
    ).rejects.toThrow('Failed to delete Item missing');

    expect(database.db.select().from(schema.operationLogs).all()).toHaveLength(0);
  });
});
