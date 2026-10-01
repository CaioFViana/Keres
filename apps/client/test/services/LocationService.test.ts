/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createLocationService } from '../../src/services/storymanagement/LocationService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The location service's listing, tag join and delete cascade.
 *
 * The list joins tags through a left join and then re-groups rows into locations in code, so the
 * interesting failures are all here: a deleted tag leaking into the group, the tag filter matching
 * a relation of another entity type, and the sort switch. The delete cascade is the one the roadmap
 * calls out by name: a `Location` tombstone must tombstone its `LocationRelation` rows with one
 * logged operation each, or the other device keeps navigating to a place that no longer exists.
 *
 * Three paths are deliberately not covered: the "failed to retrieve the row we just wrote" throws
 * in update/delete, and the catch in `getAllByStoryId`, which needs the database itself to fail.
 */

let database: TestDatabase;

const seedLocation = async (id: string, overrides: Record<string, unknown> = {}): Promise<void> => {
  await database.db.insert(schema.locations).values({
    id,
    storyId: TEST_STORY_ID,
    name: `Place ${id}`,
    ...entityBase,
    deletedAt: null,
    ...overrides,
  });
};

const seedTag = async (id: string, name: string, isDeleted = false): Promise<void> => {
  await database.db.insert(schema.tags).values({
    id,
    storyId: TEST_STORY_ID,
    name,
    ...entityBase,
    isDeleted,
  });
};

const seedTagRelation = async (
  id: string,
  tagId: string,
  relationId: string,
  relationType = 'Location',
): Promise<void> => {
  await database.db.insert(schema.tagRelations).values({
    id,
    storyId: TEST_STORY_ID,
    tagId,
    relationId,
    relationType,
    ...entityBase,
    deletedAt: null,
  });
};

const operationsForEntity = async (entityId: string) =>
  (await database.db.query.operationLogs.findMany()).filter(
    (operation) => operation.entityId === entityId,
  );

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('LocationService listing', () => {
  it('groups each location with its live tags and drops deleted ones', async () => {
    const service = createLocationService(database.db);
    await seedLocation('harbor');
    await seedTag('t-safe', 'Safe');
    await seedTag('t-gone', 'Gone', true);
    await seedTagRelation('r1', 't-safe', 'harbor');
    await seedTagRelation('r2', 't-gone', 'harbor');

    const rows = await service.getLocationsByStoryId(TEST_STORY_ID);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tags.map((tag) => tag.id)).toEqual(['t-safe']);
  });

  it('filters by tags of locations only, not by other entity types', async () => {
    const service = createLocationService(database.db);
    await seedLocation('harbor');
    await seedLocation('forest');
    await seedTag('t-safe', 'Safe');
    await seedTagRelation('r1', 't-safe', 'harbor', 'Location');
    await seedTagRelation('r2', 't-safe', 'some-character', 'Character');

    const rows = await service.getLocationsByStoryId(TEST_STORY_ID, undefined, ['t-safe']);

    expect(rows.map((row) => row.id)).toEqual(['harbor']);
  });

  it('ignores an empty tag filter instead of matching nothing', async () => {
    const service = createLocationService(database.db);
    await seedLocation('harbor');

    expect(
      (await service.getLocationsByStoryId(TEST_STORY_ID, undefined, [])).map((row) => row.id),
    ).toEqual(['harbor']);
  });

  it('sorts by name, created and updated timestamps in both directions', async () => {
    const service = createLocationService(database.db);
    await seedLocation('a', {
      name: 'Bravo',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    await seedLocation('b', {
      name: 'Alpha',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-15T00:00:00.000Z'),
    });

    const byName = await service.getLocationsByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      'name',
      'asc',
    );
    expect(byName.map((row) => row.id)).toEqual(['b', 'a']);
    const byNameDesc = await service.getLocationsByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      'name',
      'desc',
    );
    expect(byNameDesc.map((row) => row.id)).toEqual(['a', 'b']);
    const byCreated = await service.getLocationsByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      'createdAt',
      'asc',
    );
    expect(byCreated.map((row) => row.id)).toEqual(['a', 'b']);
    const byUpdated = await service.getLocationsByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      'updatedAt',
      'asc',
    );
    expect(byUpdated.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('falls back to name order when no sort key is given', async () => {
    const service = createLocationService(database.db);
    await seedLocation('a', { name: 'Bravo' });
    await seedLocation('b', { name: 'Alpha' });

    const rows = await service.getLocationsByStoryId(TEST_STORY_ID);

    expect(rows.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('narrows by native advanced criteria and warns on a field without metadata', async () => {
    const service = createLocationService(database.db);
    await seedLocation('harbor', { climate: 'Foggy' });
    await seedLocation('desert', { climate: 'Dry' });

    const rows = await service.getLocationsByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      undefined,
      'asc',
      { climate: 'fog' },
    );
    expect(rows.map((row) => row.id)).toEqual(['harbor']);

    const unfiltered = await service.getLocationsByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      undefined,
      'asc',
      { noSuchField: 'x' },
    );
    expect(unfiltered).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith(
      'No metadata found for advanced search field: noSuchField',
    );
  });

  it('returns an empty list when the story id is missing', async () => {
    const service = createLocationService(database.db);
    await seedLocation('harbor');

    expect(await service.getAllByStoryId('')).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('getAllByStoryId: storyId is required.');
    expect((await service.getAllByStoryId(TEST_STORY_ID)).map((row) => row.id)).toEqual(['harbor']);
  });
});

describe('LocationService mutations', () => {
  it('refuses to update a location that does not exist', async () => {
    const service = createLocationService(database.db);

    await expect(service.updateLocation(TEST_USER_ID, 'missing', { name: 'X' })).rejects.toThrow(
      'not found for update',
    );
  });

  it('skips the write and the operation log when nothing changed', async () => {
    const service = createLocationService(database.db);
    await seedLocation('harbor', { name: 'Harbor' });

    const result = await service.updateLocation(TEST_USER_ID, 'harbor', { name: 'Harbor' });

    expect(result.name).toBe('Harbor');
    expect(await operationsForEntity('harbor')).toEqual([]);
  });

  it('ignores a delete for a location that does not exist', async () => {
    const service = createLocationService(database.db);

    await service.deleteLocation(TEST_USER_ID, 'missing');

    expect(console.warn).toHaveBeenCalledWith('Attempted to delete non-existent location missing.');
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });

  it('tombstones the location and each of its relations with their own operations', async () => {
    const service = createLocationService(database.db);
    await seedLocation('harbor');
    await seedLocation('forest');
    await seedLocation('desert');
    for (const [id, locationAId, locationBId, relationType] of [
      ['r1', 'harbor', 'forest', 'contains'],
      ['r2', 'desert', 'harbor', 'connected_to'],
      ['r3', 'desert', 'forest', 'connected_to'],
    ] as const) {
      await database.db.insert(schema.locationRelations).values({
        id,
        storyId: TEST_STORY_ID,
        locationAId,
        locationBId,
        relationType,
        ...entityBase,
        deletedAt: null,
      });
    }

    await service.deleteLocation(TEST_USER_ID, 'harbor');

    const relations = await database.db.query.locationRelations.findMany();
    expect(relations.find((row) => row.id === 'r1')?.isDeleted).toBe(true);
    expect(relations.find((row) => row.id === 'r2')?.isDeleted).toBe(true);
    expect(relations.find((row) => row.id === 'r3')?.isDeleted).toBe(false);
    const logged = await database.db.query.operationLogs.findMany();
    expect(
      logged
        .filter((operation) => operation.entityType === 'LocationRelation')
        .map((operation) => [operation.entityId, operation.operationType]),
    ).toEqual(
      expect.arrayContaining([
        ['r1', 'delete'],
        ['r2', 'delete'],
      ]),
    );
    expect(
      logged.find(
        (operation) => operation.entityType === 'Location' && operation.entityId === 'harbor',
      )?.operationType,
    ).toBe('delete');
    expect(
      await database.db.query.locations.findFirst({
        where: eq(schema.locations.id, 'harbor'),
      }),
    ).toMatchObject({ isDeleted: true });
  });

  it('deletes cleanly when the location has no live relations', async () => {
    const service = createLocationService(database.db);
    await seedLocation('harbor');

    await service.deleteLocation(TEST_USER_ID, 'harbor');

    const logged = await database.db.query.operationLogs.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ entityType: 'Location', operationType: 'delete' });
  });
});
