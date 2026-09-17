/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createStatStrengthService } from '../../src/services/storymanagement/StatStrengthService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The stat-ladder writes: update, delete and whole-ladder replacement.
 *
 * `StatStrengthService.test.ts` covers the reads and the create path against a mocked database.
 * A ladder, though, is a set with an invariant - ascending floors, no duplicates - and the
 * interesting failures only show against the real rows: swapping two tiers' floors through
 * `replaceLadder` (which must not trip on the intermediate collision), moving one tier onto
 * another's floor through `updateStrength` (which must refuse), and deleting a tier twice
 * (which must stay quiet the second time).
 *
 * Every write records its own operation: the ladder editor saves the final set, not keystrokes,
 * so each tier's create/update/delete is what the other device replays.
 */

let database: TestDatabase;

const seedTier = async (
  id: string,
  label: string,
  minValue: number,
  statId: string | null = null,
): Promise<void> => {
  await database.db.insert(schema.statStrengths).values({
    id,
    storyId: TEST_STORY_ID,
    statId,
    label,
    minValue,
    ...entityBase,
    deletedAt: null,
  });
};

const ladderOf = async (statId: string | null = null) =>
  createStatStrengthService(database.db).getLadder(TEST_STORY_ID, statId);

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

afterEach(() => database.close());

describe('StatStrengthService update and delete', () => {
  it('renames a tier and moves its floor when the floor stays unique', async () => {
    const service = createStatStrengthService(database.db);
    await seedTier('t-low', 'Low', 0);
    await seedTier('t-high', 'High', 10);

    await service.updateStrength(TEST_USER_ID, 't-high', { label: 'Peak', minValue: 20 });

    expect((await ladderOf()).map((tier) => `${tier.label}:${tier.minValue}`)).toEqual([
      'Low:0',
      'Peak:20',
    ]);
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ entityType: 'StatStrength', operationType: 'update' });
  });

  it('refuses to move a tier onto another tier floor', async () => {
    const service = createStatStrengthService(database.db);
    await seedTier('t-low', 'Low', 0);
    await seedTier('t-high', 'High', 10);

    await expect(service.updateStrength(TEST_USER_ID, 't-high', { minValue: 0 })).rejects.toThrow(
      'already has a tier starting at 0',
    );
    expect((await ladderOf()).map((tier) => tier.minValue)).toEqual([0, 10]);
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });

  it('refuses to update a tier that does not exist', async () => {
    const service = createStatStrengthService(database.db);

    await expect(service.updateStrength(TEST_USER_ID, 'missing', { label: 'X' })).rejects.toThrow(
      'not found for update',
    );
  });

  it('tombstones a tier once and stays quiet on a second delete', async () => {
    const service = createStatStrengthService(database.db);
    await seedTier('t-low', 'Low', 0);

    await service.deleteStrength(TEST_USER_ID, 't-low');
    await service.deleteStrength(TEST_USER_ID, 't-low');
    await service.deleteStrength(TEST_USER_ID, 'missing');

    expect(await ladderOf()).toEqual([]);
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ entityType: 'StatStrength', operationType: 'delete' });
  });
});

describe('StatStrengthService replaceLadder', () => {
  it('creates, renames and removes tiers to reach the final set', async () => {
    const service = createStatStrengthService(database.db);
    await seedTier('t-low', 'Low', 0);
    await seedTier('t-mid', 'Mid', 10);
    await seedTier('t-old', 'Old', 20);

    await service.replaceLadder(TEST_USER_ID, TEST_STORY_ID, null, [
      { id: 't-low', label: 'Low', minValue: 0 },
      { id: 't-mid', label: 'Middle', minValue: 10 },
      { label: 'Peak', minValue: 30 },
    ]);

    expect((await ladderOf()).map((tier) => `${tier.label}:${tier.minValue}`)).toEqual([
      'Low:0',
      'Middle:10',
      'Peak:30',
    ]);
    const types = (await database.db.query.operationLogs.findMany())
      .map((operation) => operation.operationType)
      .sort();
    expect(types).toEqual(['create', 'delete', 'update']);
  });

  it('swaps two tiers floors without tripping on the intermediate collision', async () => {
    const service = createStatStrengthService(database.db);
    await seedTier('t-low', 'Low', 0);
    await seedTier('t-high', 'High', 10);

    await service.replaceLadder(TEST_USER_ID, TEST_STORY_ID, null, [
      { id: 't-low', label: 'Low', minValue: 10 },
      { id: 't-high', label: 'High', minValue: 0 },
    ]);

    expect((await ladderOf()).map((tier) => `${tier.label}:${tier.minValue}`)).toEqual([
      'High:0',
      'Low:10',
    ]);
  });

  it('replaces only the requested ladder, leaving the others alone', async () => {
    const service = createStatStrengthService(database.db);
    await seedTier('t-default', 'Default', 0, null);
    await seedTier('t-stat', 'Stat tier', 5, 'stat-1');

    await service.replaceLadder(TEST_USER_ID, TEST_STORY_ID, 'stat-1', [
      { label: 'Fresh', minValue: 1 },
    ]);

    expect((await ladderOf(null)).map((tier) => tier.id)).toEqual(['t-default']);
    expect((await ladderOf('stat-1')).map((tier) => tier.label)).toEqual(['Fresh']);
  });

  it('writes nothing when the final set already matches', async () => {
    const service = createStatStrengthService(database.db);
    await seedTier('t-low', 'Low', 0);

    await service.replaceLadder(TEST_USER_ID, TEST_STORY_ID, null, [
      { id: 't-low', label: 'Low', minValue: 0 },
    ]);

    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });
});
