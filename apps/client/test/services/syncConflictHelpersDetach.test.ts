/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { detachLandedOperation } from '../../src/services/sync/syncConflictHelpers';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');

let database: TestDatabase;

const seedConflict = (id: string, localOperationIds: string[], status = 'pending') =>
  database.db.insert(schema.syncConflicts).values({
    id,
    storyId: STORY_ID,
    entityType: 'Character',
    entityId: 'character-1',
    reason: 'concurrent_edit',
    localOperationType: 'update',
    localOperationIds: JSON.stringify(localOperationIds),
    localValues: '{}',
    status,
    detectedAt: NOW,
  } as never);

const conflictRow = (id: string) =>
  database.db.query.syncConflicts.findFirst({ where: eq(schema.syncConflicts.id, id) });

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(() => database.close());

describe('detachLandedOperation', () => {
  it('takes the landed operation out of the conflict and keeps the rest of it pending', async () => {
    await seedConflict('two-ops', ['landed', 'waiting']);

    await expect(detachLandedOperation(database.db, STORY_ID, 'landed')).resolves.toBe(true);

    const row = await conflictRow('two-ops');
    expect(row).toMatchObject({ status: 'pending', localOperationIds: '["waiting"]' });
  });

  it('closes a conflict left with no operation of its own as the local side kept', async () => {
    await seedConflict('one-op', ['landed']);

    await expect(detachLandedOperation(database.db, STORY_ID, 'landed')).resolves.toBe(true);

    expect(await conflictRow('one-op')).toMatchObject({
      status: 'resolved',
      resolution: 'keep_local',
      localOperationIds: '[]',
    });
  });

  it('leaves conflicts that do not hold the operation, or are already closed, alone', async () => {
    await seedConflict('other', ['someone-else']);
    await seedConflict('closed', ['landed'], 'resolved');

    await expect(detachLandedOperation(database.db, STORY_ID, 'landed')).resolves.toBe(false);

    expect((await conflictRow('other'))!.localOperationIds).toBe('["someone-else"]');
    expect((await conflictRow('closed'))!.localOperationIds).toBe('["landed"]');
  });
});
