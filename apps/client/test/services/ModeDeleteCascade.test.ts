/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createModeService } from '../../src/services/storymanagement/ModeService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The mode delete cascade, against the real database.
 *
 * `ModeService.test.ts` covers the reads and the create/update paths against a mocked database.
 * What it cannot cover is the cascade: deleting a mode tombstones that mode's `StatRelation`
 * values with one logged operation each, because without the mode those values are orphaned and
 * the server would refuse any later edit to them. Values of other modes - and the modeless ones -
 * must survive untouched.
 */

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await seedLocalStory(database);
  await database.db.insert(schema.characters).values({
    id: 'ada',
    storyId: TEST_STORY_ID,
    name: 'Ada',
    ...entityBase,
  });
  await database.db.insert(schema.stats).values({
    id: 'stat-1',
    storyId: TEST_STORY_ID,
    name: 'Courage',
    isPrimary: true,
    order: 0,
    ...entityBase,
    deletedAt: null,
  });
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('ModeService delete cascade', () => {
  it('tombstones the mode values with their own operations, sparing the others', async () => {
    const service = createModeService(database.db);
    const mode = await service.createMode(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      characterId: 'ada',
      name: 'Battle',
      order: 0,
    });
    await database.db.insert(schema.statRelations).values([
      {
        id: 'v-mode',
        storyId: TEST_STORY_ID,
        characterId: 'ada',
        modeId: mode.id,
        statId: 'stat-1',
        value: 3,
        ...entityBase,
        deletedAt: null,
      },
      {
        id: 'v-plain',
        storyId: TEST_STORY_ID,
        characterId: 'ada',
        modeId: null,
        statId: 'stat-1',
        value: 1,
        ...entityBase,
        deletedAt: null,
      },
    ]);

    await service.deleteMode(TEST_USER_ID, mode.id);

    expect(await service.getById(mode.id)).toBeUndefined();
    const values = await database.db.query.statRelations.findMany();
    expect(values.find((row) => row.id === 'v-mode')).toMatchObject({ isDeleted: true });
    expect(values.find((row) => row.id === 'v-plain')).toMatchObject({ isDeleted: false });
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged.map((operation) => [operation.entityType, operation.operationType])).toEqual([
      ['Mode', 'create'],
      ['StatRelation', 'delete'],
      ['Mode', 'delete'],
    ]);
  });

  it('deletes a valueless mode with a single operation', async () => {
    const service = createModeService(database.db);
    const mode = await service.createMode(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      characterId: 'ada',
      name: 'Battle',
      order: 0,
    });

    await service.deleteMode(TEST_USER_ID, mode.id);

    const logged = await database.db.query.operationLogs.findMany();
    expect(logged.map((operation) => [operation.entityType, operation.operationType])).toEqual([
      ['Mode', 'create'],
      ['Mode', 'delete'],
    ]);
  });
});
