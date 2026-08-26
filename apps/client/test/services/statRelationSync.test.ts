/**
 * @jest-environment node
 */
import { asc } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createStatRelationService } from '../../src/services/storymanagement/StatRelationService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * What the client records in the operation log when touching stat values.
 *
 * The push sends the *base* version derived from the payload (`payload.version - 1`, see
 * `SyncEngineService.deriveBaseVersion`), so a payload with no numeric `version` becomes an
 * update/delete with no base - and the server refuses that as `validation`, which is the generic "the
 * data is not valid" conflict that shows up on screen.
 */
const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const USER_ID = 'local-user';
const CHARACTER_ID = 'char-1';
const STAT_ID = 'stat-1';
const NOW = new Date('2026-08-10T12:00:00.000Z');
const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

let database: TestDatabase;

const service = () => createStatRelationService(database.db);

async function operations() {
  return database.db.query.operationLogs.findMany({
    orderBy: ({ operationVersion }) => [asc(operationVersion)],
  });
}

/** The base the push would send for this operation. */
function baseVersionOf(payload: string): number | undefined {
  const version = JSON.parse(payload)?.version;
  return typeof version === 'number' && version >= 1 ? version - 1 : undefined;
}

beforeEach(async () => {
  database = await createTestDatabase();
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: USER_ID,
    title: 'A Queda',
    type: 'linear',
    statSystem: true,
    ...base,
  });
  await database.db
    .insert(schema.characters)
    .values({ id: CHARACTER_ID, storyId: STORY_ID, name: 'Ilda', ...base });
  await database.db.insert(schema.stats).values({
    id: STAT_ID,
    storyId: STORY_ID,
    name: 'Dexterity',
    isPrimary: true,
    order: 0,
    ...base,
  });
});

afterEach(() => {
  database.close();
});

const set = (value: number, modeId: string | null = null) =>
  service().setValue(USER_ID, {
    storyId: STORY_ID,
    characterId: CHARACTER_ID,
    modeId,
    statId: STAT_ID,
    value,
  });

const clear = (modeId: string | null = null) =>
  service().clearValue(USER_ID, { characterId: CHARACTER_ID, modeId, statId: STAT_ID });

describe('the operation stream of stat values', () => {
  it('logs a create with the version the server can derive a base from', async () => {
    await set(5);

    const [operation] = await operations();
    expect(operation).toMatchObject({ operationType: 'create', entityType: 'StatRelation' });
    expect(baseVersionOf(operation!.payload)).toBe(0);
  });

  it('logs an update whose base version matches the row the server has', async () => {
    await set(5);
    await set(7);

    const [, update] = await operations();
    expect(update).toMatchObject({ operationType: 'update' });
    expect(baseVersionOf(update!.payload)).toBe(1);
  });

  it('logs a delete whose base version matches the row the server has', async () => {
    await set(5);
    await clear();

    const [, remove] = await operations();
    expect(remove).toMatchObject({ operationType: 'delete' });
    expect(baseVersionOf(remove!.payload)).toBe(1);
  });

  it('keeps only one live row through create, clear and create again', async () => {
    await set(5);
    await clear();
    await set(7);

    const rows = await database.db.query.statRelations.findMany();
    expect(rows.filter((row) => !row.isDeleted)).toHaveLength(1);
    expect(rows.filter((row) => !row.isDeleted)[0]!.value).toBe(7);
    expect((await operations()).map((row) => row.operationType)).toEqual([
      'create',
      'delete',
      'create',
    ]);
  });

  it('never writes two live rows for the same character, mode and stat', async () => {
    // Two writes fired in parallel is what a repeated `onBlur` produces on screen.
    await Promise.all([set(5), set(7)]);

    const live = (await database.db.query.statRelations.findMany()).filter((row) => !row.isDeleted);
    expect(live).toHaveLength(1);
  });

  it('reuses the row of a mode instead of stacking one per edit', async () => {
    await database.db.insert(schema.modes).values({
      id: 'mode-1',
      storyId: STORY_ID,
      characterId: CHARACTER_ID,
      name: 'Na tempestade',
      order: 0,
      ...base,
    });

    await set(5, 'mode-1');
    await set(9, 'mode-1');

    const live = (await database.db.query.statRelations.findMany()).filter((row) => !row.isDeleted);
    expect(live).toHaveLength(1);
    expect(live[0]!.value).toBe(9);
  });
});

/**
 * Devices that already ran the version with the race were left with two live rows for the same field,
 * and the server refuses the second on every synchronization. The first write after the fix has to undo
 * that by itself, otherwise the conflict comes back forever.
 */
describe('repairing duplicates that already exist on the device', () => {
  // A ULID is sortable by creation time, and it is that order the service uses to decide which one
  // stays - ids invented outside that order would make the test pass for the wrong reason.
  const OLDER = '01AAAAAAAAAAAAAAAAAAAAAAAA';
  const NEWER = '01BBBBBBBBBBBBBBBBBBBBBBBB';

  async function seedDuplicatePair() {
    for (const [id, value] of [
      [OLDER, 5],
      [NEWER, 7],
    ] as const) {
      await database.db.insert(schema.statRelations).values({
        id,
        storyId: STORY_ID,
        characterId: CHARACTER_ID,
        modeId: null,
        statId: STAT_ID,
        value,
        ...base,
      });
    }
  }

  it('collapses the extra row on the next write, keeping the oldest', async () => {
    await seedDuplicatePair();

    await set(9);

    const rows = await database.db.query.statRelations.findMany();
    const live = rows.filter((row) => !row.isDeleted);
    expect(live).toHaveLength(1);
    expect(live[0]!.id).toBe(OLDER);
    expect(live[0]!.value).toBe(9);
  });

  it('logs the deletion of the extra row, so the server converges too', async () => {
    await seedDuplicatePair();

    await set(9);

    const logged = (await operations()).filter((row) => row.operationType === 'delete');
    expect(logged).toHaveLength(1);
    expect(logged[0]!.entityId).toBe(NEWER);
    expect(baseVersionOf(logged[0]!.payload)).toBe(1);
  });

  it('clears every live row at once, so a duplicate cannot resurrect the value', async () => {
    await seedDuplicatePair();

    await clear();

    const rows = await database.db.query.statRelations.findMany();
    expect(rows.filter((row) => !row.isDeleted)).toEqual([]);
    expect((await operations()).filter((row) => row.operationType === 'delete')).toHaveLength(2);
  });
});
