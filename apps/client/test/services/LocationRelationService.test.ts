/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createLocationRelationService } from '../../src/services/storymanagement/LocationRelationService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The location-hierarchy service: containment reads, the parent swap and the connection edges.
 *
 * Locations form a `contains` tree plus `connected_to` shortcuts, and the pickers lean on the
 * reads: the parent picker excludes the location's own ancestors, the child picker its
 * descendants. `setParent` is specified as two operations (delete the old edge, create the new
 * one) rather than an update, so a device that missed the middle state still converges. The
 * cycle check here is explicitly non-authoritative - quick UI feedback only; the server validates
 * for real.
 *
 * Three paths are deliberately not covered: the "the write returned no row" guards on the
 * delete/create paths, and the `excludeRelationId` parameter of the connection lookup, which no
 * caller passes.
 */

let database: TestDatabase;

const seedLocation = async (id: string): Promise<void> => {
  await database.db.insert(schema.locations).values({
    id,
    storyId: TEST_STORY_ID,
    name: `Place ${id}`,
    ...entityBase,
    deletedAt: null,
  });
};

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await seedLocalStory(database);
  await seedLocation('world');
  await seedLocation('harbor');
  await seedLocation('docks');
  await seedLocation('forest');
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('LocationRelationService reads', () => {
  it('reads the parent, the children and the connections of a location', async () => {
    const service = createLocationRelationService(database.db);
    await service.setParent(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'world');
    await service.setParent(TEST_USER_ID, TEST_STORY_ID, 'docks', 'harbor');
    await service.addConnection(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'forest');

    const parent = await service.getParentRelation(TEST_STORY_ID, 'harbor');
    expect(parent).toMatchObject({ locationAId: 'world', locationBId: 'harbor' });
    expect(await service.getParentRelation(TEST_STORY_ID, 'world')).toBeUndefined();

    const children = await service.getChildRelations(TEST_STORY_ID, 'harbor');
    expect(children.map((row) => row.locationBId)).toEqual(['docks']);

    const connections = await service.getConnectionRelations(TEST_STORY_ID, 'forest');
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({ relationType: 'connected_to' });

    const all = await service.getAllRelationsForStory(TEST_STORY_ID);
    expect(all).toHaveLength(3);
  });

  it('walks ancestors up and descendants down without including the location itself', async () => {
    const service = createLocationRelationService(database.db);
    await service.setParent(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'world');
    await service.setParent(TEST_USER_ID, TEST_STORY_ID, 'docks', 'harbor');

    expect(await service.getAncestorIds(TEST_STORY_ID, 'docks')).toEqual(
      new Set(['harbor', 'world']),
    );
    expect(await service.getAncestorIds(TEST_STORY_ID, 'world')).toEqual(new Set());
    expect(await service.getDescendantIds(TEST_STORY_ID, 'world')).toEqual(
      new Set(['harbor', 'docks']),
    );
    expect(await service.getDescendantIds(TEST_STORY_ID, 'docks')).toEqual(new Set());
  });
});

describe('LocationRelationService setParent', () => {
  it('swaps the parent as a delete plus a create', async () => {
    const service = createLocationRelationService(database.db);
    await service.setParent(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'world');

    await service.setParent(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'forest');

    const parent = await service.getParentRelation(TEST_STORY_ID, 'harbor');
    expect(parent?.locationAId).toBe('forest');
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged.map((operation) => operation.operationType)).toEqual([
      'create',
      'delete',
      'create',
    ]);
  });

  it('removes the parent edge when given null, and stays quiet without one', async () => {
    const service = createLocationRelationService(database.db);
    await service.setParent(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'world');

    await service.setParent(TEST_USER_ID, TEST_STORY_ID, 'harbor', null);

    expect(await service.getParentRelation(TEST_STORY_ID, 'harbor')).toBeUndefined();
    const logged = await service
      .setParent(TEST_USER_ID, TEST_STORY_ID, 'harbor', null)
      .then(() => database.db.query.operationLogs.findMany());
    expect(logged.map((operation) => operation.operationType)).toEqual(['create', 'delete']);
  });

  it('refuses a location as its own parent', async () => {
    const service = createLocationRelationService(database.db);

    await expect(
      service.setParent(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'harbor'),
    ).rejects.toThrow('its own parent');
  });

  it('refuses a parent that would cycle the hierarchy', async () => {
    const service = createLocationRelationService(database.db);
    await service.setParent(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'world');
    await service.setParent(TEST_USER_ID, TEST_STORY_ID, 'docks', 'harbor');

    await expect(service.setParent(TEST_USER_ID, TEST_STORY_ID, 'world', 'docks')).rejects.toThrow(
      'would create a cycle',
    );
  });
});

describe('LocationRelationService connections and removal', () => {
  it('refuses a connection to itself and a duplicate pair', async () => {
    const service = createLocationRelationService(database.db);

    await expect(
      service.addConnection(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'harbor'),
    ).rejects.toThrow('connected to itself');

    await service.addConnection(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'forest');
    await expect(
      service.addConnection(TEST_USER_ID, TEST_STORY_ID, 'forest', 'harbor'),
    ).rejects.toThrow('already exists');
  });

  it('removes a relation once and reports unknown or removed ones', async () => {
    const service = createLocationRelationService(database.db);
    const created = await service.addConnection(TEST_USER_ID, TEST_STORY_ID, 'harbor', 'forest');

    expect(await service.removeRelation(TEST_USER_ID, created.id)).toBe(true);
    expect(await service.removeRelation(TEST_USER_ID, created.id)).toBe(false);
    expect(await service.removeRelation(TEST_USER_ID, 'missing')).toBe(false);

    const logged = await database.db.query.operationLogs.findMany();
    expect(logged.map((operation) => operation.operationType)).toEqual(['create', 'delete']);
  });
});
