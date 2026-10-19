/**
 * @jest-environment node
 */
import * as schema from '@/src/db/schema';
import { heldStorySaveReport } from '@/src/services/sync/heldStorySave';
import { createTestDatabase, type TestDatabase } from '@/test/helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OTHER_STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAW';

let database: TestDatabase;
let sequence: number;

async function seedConflict(overrides: Partial<typeof schema.syncConflicts.$inferInsert> = {}) {
  sequence += 1;
  await database.db.insert(schema.syncConflicts).values({
    id: `conflict-${sequence}`,
    storyId: STORY_ID,
    entityType: 'Story',
    entityId: STORY_ID,
    reason: 'version_conflict',
    localOperationType: 'update',
    localOperationIds: '[]',
    localValues: '{}',
    serverValues: '{"title":"Do servidor"}',
    status: 'pending',
    detectedAt: new Date('2026-08-10T12:00:00.000Z'),
    ...overrides,
  });
}

beforeEach(async () => {
  database = await createTestDatabase();
  sequence = 0;
});

describe('heldStorySaveReport', () => {
  it('reports nothing when the story record has no pending conflict', async () => {
    expect(await heldStorySaveReport(database.db, STORY_ID)).toEqual({
      conflicts: 0,
      refusals: [],
    });
  });

  it('names the refusal that holds the save, with the message the server gave', async () => {
    await seedConflict({ reason: 'version_conflict', message: 'The server holds version 3.' });

    expect(await heldStorySaveReport(database.db, STORY_ID)).toEqual({
      conflicts: 1,
      refusals: [
        {
          entity: 'Story',
          entityId: STORY_ID,
          type: 'update',
          reason: 'version_conflict',
          message: 'The server holds version 3.',
        },
      ],
    });
  });

  it('falls back to the reason when the conflict carries no message', async () => {
    await seedConflict({ reason: 'version_conflict', message: null });

    const report = await heldStorySaveReport(database.db, STORY_ID);

    expect(report.refusals[0].message).toBe('version_conflict');
  });

  it('does not report a quarantine: a change that can never be sent holds nothing new', async () => {
    await seedConflict({ reason: 'validation', serverValues: null });

    expect(await heldStorySaveReport(database.db, STORY_ID)).toEqual({
      conflicts: 0,
      refusals: [],
    });
  });

  it('still reports a validation refusal that has a server snapshot', async () => {
    await seedConflict({ reason: 'validation', serverValues: '{"title":"Do servidor"}' });

    expect((await heldStorySaveReport(database.db, STORY_ID)).conflicts).toBe(1);
  });

  it('ignores resolved conflicts, other entities and other stories', async () => {
    await seedConflict({ status: 'resolved' });
    await seedConflict({ entityType: 'Character', entityId: 'char-1' });
    await seedConflict({ storyId: OTHER_STORY_ID, entityId: OTHER_STORY_ID });

    expect(await heldStorySaveReport(database.db, STORY_ID)).toEqual({
      conflicts: 0,
      refusals: [],
    });
  });
});
