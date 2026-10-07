/**
 * @jest-environment node
 */
import { getEntityDomainHandler, OperationLogEntityType } from '@keres/shared';
import { createClientEntitySolverContext } from '../../src/services/entity-solvers/ClientEntitySolverContext';
import { seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

afterEach(() => database.close());

describe('the name an operation log gives an entity type', () => {
  it('is never the unknown-type label for any type the logs can carry', async () => {
    const context = createClientEntitySolverContext(
      database.db,
      TEST_STORY_ID,
      ((key: string) => key) as never,
    );
    const unknown: string[] = [];

    for (const type of Object.values(OperationLogEntityType)) {
      const name = await getEntityDomainHandler(type)?.resolveOperationLogName?.(
        context,
        'missing-id',
      );
      if (name === undefined || String(name).includes('unknown_entity_type')) unknown.push(type);
    }

    // A new entity added to the logs without a word for it would show "Unknown Type" in the list.
    expect(unknown).toEqual([]);
  });

  it.each(['Sketch', 'ScenePage', 'SceneMusic', 'Song'] as const)(
    'names a %s by its own word',
    async (type) => {
      const context = createClientEntitySolverContext(
        database.db,
        TEST_STORY_ID,
        ((key: string) => key) as never,
      );

      const word = await context.noun(OperationLogEntityType[type]);

      expect(word).toBe(
        { Sketch: 'sketch', ScenePage: 'scene_page', SceneMusic: 'scene_music', Song: 'song' }[
          type
        ],
      );
    },
  );
});
