/**
 * @jest-environment node
 */
import { MAX_PRIMARY_STATS } from '@keres/shared';
import * as schema from '../../src/db/schema';
import { createStatService } from '../../src/services/storymanagement/StatService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The stat service: the primary-stat ceiling and the update/delete paths.
 *
 * A story can hold at most `MAX_PRIMARY_STATS` primary stats - the radar drawing turns unreadable
 * past that, and the server refuses the surplus. The ceiling is enforced on create *and* on the
 * promotion of an existing stat, and the existing stat being promoted must not count against
 * itself. Deletes are tombstones with one operation each; a second delete and an unknown id stay
 * quiet so a replayed pull cannot resurrect an error.
 *
 * One throw is deliberately not covered: the "the update returned no row" guard in `updateStat`,
 * which needs the row to vanish between the lookup and the write of the same call.
 */

let database: TestDatabase;

const seedStat = async (id: string, overrides: Record<string, unknown> = {}): Promise<void> => {
  await database.db.insert(schema.stats).values({
    id,
    storyId: TEST_STORY_ID,
    name: `Stat ${id}`,
    isPrimary: false,
    order: 0,
    ...entityBase,
    deletedAt: null,
    ...overrides,
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

describe('StatService reads', () => {
  it('lists live stats ordered by position then name', async () => {
    const service = createStatService(database.db);
    await seedStat('b', { order: 0, name: 'Bravo' });
    await seedStat('a', { order: 0, name: 'Alpha' });
    await seedStat('gone', { order: -1, isDeleted: true });

    expect((await service.getStatsByStoryId(TEST_STORY_ID)).map((stat) => stat.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('reads one stat by id and skips tombstoned ones', async () => {
    const service = createStatService(database.db);
    await seedStat('a');
    await seedStat('gone', { isDeleted: true });

    expect(await service.getById('a')).toMatchObject({ id: 'a' });
    expect(await service.getById('gone')).toBeUndefined();
    expect(await service.getById('missing')).toBeUndefined();
  });

  it('counts only live primary stats', async () => {
    const service = createStatService(database.db);
    await seedStat('a', { isPrimary: true });
    await seedStat('b', { isPrimary: false });
    await seedStat('gone', { isPrimary: true, isDeleted: true });

    expect(await service.countPrimaryStats(TEST_STORY_ID)).toBe(1);
  });
});

describe('StatService primary ceiling', () => {
  it('refuses a primary stat past the ceiling but still accepts secondary ones', async () => {
    const service = createStatService(database.db);
    for (let index = 0; index < MAX_PRIMARY_STATS; index += 1) {
      await seedStat(`primary-${index}`, { isPrimary: true });
    }

    await expect(
      service.createStat(TEST_USER_ID, {
        storyId: TEST_STORY_ID,
        name: 'Overflow',
        isPrimary: true,
        order: 99,
      }),
    ).rejects.toThrow(`at most ${MAX_PRIMARY_STATS} primary stats`);

    const secondary = await service.createStat(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Secondary',
      isPrimary: false,
      order: 99,
    });
    expect(secondary.isPrimary).toBe(false);
  });

  it('refuses to promote a stat past the ceiling', async () => {
    const service = createStatService(database.db);
    for (let index = 0; index < MAX_PRIMARY_STATS; index += 1) {
      await seedStat(`primary-${index}`, { isPrimary: true });
    }
    await seedStat('candidate', { isPrimary: false });

    await expect(
      service.updateStat(TEST_USER_ID, 'candidate', { isPrimary: true }),
    ).rejects.toThrow(`at most ${MAX_PRIMARY_STATS} primary stats`);
    expect(await service.getById('candidate')).toMatchObject({ isPrimary: false });
  });

  it('lets a primary stat be edited without counting itself against the ceiling', async () => {
    const service = createStatService(database.db);
    for (let index = 0; index < MAX_PRIMARY_STATS; index += 1) {
      await seedStat(`primary-${index}`, { isPrimary: true });
    }

    await service.updateStat(TEST_USER_ID, 'primary-0', { name: 'Renamed' });

    expect(await service.getById('primary-0')).toMatchObject({
      name: 'Renamed',
      isPrimary: true,
    });
  });
});

describe('StatService update and delete', () => {
  it('updates a stat and logs the change with the new version', async () => {
    const service = createStatService(database.db);
    await seedStat('a', { name: 'Old', order: 0 });

    await service.updateStat(TEST_USER_ID, 'a', { name: 'New', order: 3 });

    expect(await service.getById('a')).toMatchObject({ name: 'New', order: 3, version: 2 });
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ entityType: 'Stat', operationType: 'update' });
  });

  it('refuses to update a stat that does not exist', async () => {
    const service = createStatService(database.db);

    await expect(service.updateStat(TEST_USER_ID, 'missing', { name: 'X' })).rejects.toThrow(
      'not found for update',
    );
  });

  it('tombstones a stat once and stays quiet afterwards', async () => {
    const service = createStatService(database.db);
    await seedStat('a');

    await service.deleteStat(TEST_USER_ID, 'a');
    await service.deleteStat(TEST_USER_ID, 'a');
    await service.deleteStat(TEST_USER_ID, 'missing');

    expect(await service.getById('a')).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('Attempted to delete non-existent stat missing.');
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ entityType: 'Stat', operationType: 'delete' });
  });
});
