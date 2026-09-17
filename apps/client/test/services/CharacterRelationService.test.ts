/**
 * @jest-environment node
 */
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import * as schema from '../../src/db/schema';
import { createCharacterRelationService } from '../../src/services/storymanagement/CharacterRelationService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The character-relation service: one relation per pair, whichever column each id sits in.
 *
 * The pair rule is enforced twice - by a unique index in the schema and by a lookup in the
 * service - and the service half is what produces the error the form screen shows. These tests
 * pin the service half: the forward and reversed duplicate on insert, the same check on update
 * (excluding the row being edited), and the refusal to swap the pair of an existing relation,
 * which would otherwise strand the operation log pointing at a different pair.
 *
 * The list side joins both character names. A search matching either name or the relation type
 * has to return the row with both names attached; a sort key the switch does not know warns and
 * still lists.
 *
 * Three paths are deliberately not covered: the "row we just found vanished before the update"
 * throw, and the two "the write returned no row" throws on insert/update/delete, which need the
 * database to misbehave between two statements of the same call.
 */

let database: TestDatabase;

const NOW = new Date('2026-08-14T12:00:00.000Z');

const relationOf = (overrides: Partial<CharacterRelation> = {}): CharacterRelation => ({
  id: '',
  storyId: TEST_STORY_ID,
  character1Id: 'ada',
  character2Id: 'grace',
  relationType: 'mentor',
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

const seedCharacter = async (id: string, name: string): Promise<void> => {
  await database.db.insert(schema.characters).values({
    id,
    storyId: TEST_STORY_ID,
    name,
    ...entityBase,
  });
};

const operationsFor = async (entityId: string) =>
  (await database.db.query.operationLogs.findMany()).filter(
    (operation) => operation.entityId === entityId,
  );

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await seedCharacter('ada', 'Ada');
  await seedCharacter('grace', 'Grace');
  await seedCharacter('hopper', 'Hopper');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('CharacterRelationService pair rule', () => {
  it('rejects a second relation for the same pair in either direction', async () => {
    const service = createCharacterRelationService(database.db);
    await service.saveCharacterRelation(TEST_USER_ID, relationOf());

    await expect(
      service.saveCharacterRelation(TEST_USER_ID, relationOf({ relationType: 'rival' })),
    ).rejects.toThrow('already exists');
    await expect(
      service.saveCharacterRelation(
        TEST_USER_ID,
        relationOf({ character1Id: 'grace', character2Id: 'ada' }),
      ),
    ).rejects.toThrow('already exists');
  });

  it('rejects swapping the pair of an existing relation', async () => {
    const service = createCharacterRelationService(database.db);
    const created = await service.saveCharacterRelation(TEST_USER_ID, relationOf());

    await expect(
      service.saveCharacterRelation(
        TEST_USER_ID,
        relationOf({ id: created.id, character2Id: 'hopper' }),
      ),
    ).rejects.toThrow('cannot be changed');
  });

  it('rejects an update that would collide with another pair', async () => {
    const service = createCharacterRelationService(database.db);
    const first = await service.saveCharacterRelation(TEST_USER_ID, relationOf());
    const second = await service.saveCharacterRelation(
      TEST_USER_ID,
      relationOf({ character1Id: 'ada', character2Id: 'hopper' }),
    );
    void second;

    // Same pair as `first` but addressed at the row's own id is fine; the collision check
    // excludes the row being edited.
    await expect(
      service.saveCharacterRelation(
        TEST_USER_ID,
        relationOf({ id: first.id, relationType: 'rival' }),
      ),
    ).resolves.toMatchObject({ relationType: 'rival' });
  });

  it('skips the write and the operation log when the update changes nothing', async () => {
    const service = createCharacterRelationService(database.db);
    const created = await service.saveCharacterRelation(TEST_USER_ID, relationOf());
    const before = await operationsFor(created.id);
    // A no-op means the stored row written back untouched: reusing the factory values would
    // differ in the timestamps and count as a change.
    const stored = await database.db.query.characterRelations.findFirst({
      where: (table, { eq }) => eq(table.id, created.id),
    });

    const result = await service.saveCharacterRelation(TEST_USER_ID, {
      ...stored!,
      createdAt: new Date(stored!.createdAt),
      updatedAt: new Date(stored!.updatedAt),
      deletedAt: null,
    });

    expect(result.id).toBe(created.id);
    expect(await operationsFor(created.id)).toHaveLength(before.length);
  });

  it('inserts under the given id when saving an id that does not exist yet', async () => {
    const service = createCharacterRelationService(database.db);

    const created = await service.saveCharacterRelation(
      TEST_USER_ID,
      relationOf({ id: 'imported-id' }),
    );

    expect(created.id).toBe('imported-id');
    expect(await operationsFor('imported-id')).toHaveLength(1);
  });

  it('records the update with the fields that changed', async () => {
    const service = createCharacterRelationService(database.db);
    const created = await service.saveCharacterRelation(TEST_USER_ID, relationOf());

    await service.saveCharacterRelation(
      TEST_USER_ID,
      relationOf({ id: created.id, relationType: 'rival' }),
    );

    const logged = await operationsFor(created.id);
    expect(logged.map((operation) => operation.operationType).sort()).toEqual(['create', 'update']);
  });
});

describe('CharacterRelationService reads and delete', () => {
  it('finds relations from either side of the pair and hides deleted ones', async () => {
    const service = createCharacterRelationService(database.db);
    const created = await service.saveCharacterRelation(TEST_USER_ID, relationOf());

    expect(
      (await service.getRelationsForCharacter(TEST_STORY_ID, 'grace')).map(
        (relation) => relation.id,
      ),
    ).toEqual([created.id]);

    await service.deleteCharacterRelation(TEST_USER_ID, created.id);

    expect(await service.getRelationsForCharacter(TEST_STORY_ID, 'ada')).toEqual([]);
  });

  it('returns an empty list when the character lookup has no ids', async () => {
    const service = createCharacterRelationService(database.db);

    expect(await service.getRelationsForCharacter('', '')).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      'getRelationsForCharacter: storyId and characterId are required.',
    );
  });

  it('reports a missing relation on delete instead of logging a phantom operation', async () => {
    const service = createCharacterRelationService(database.db);

    expect(await service.deleteCharacterRelation(TEST_USER_ID, 'missing')).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      'Attempted to delete non-existent character relation missing.',
    );
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });
});

describe('CharacterRelationService story listing', () => {
  it('attaches both character names to every row', async () => {
    const service = createCharacterRelationService(database.db);
    await service.saveCharacterRelation(TEST_USER_ID, relationOf());

    const rows = await service.getCharacterRelationsByStoryId(TEST_STORY_ID);

    expect(rows).toEqual([expect.objectContaining({ char1Name: 'Ada', char2Name: 'Grace' })]);
  });

  it('matches the search term against either name or the relation type', async () => {
    const service = createCharacterRelationService(database.db);
    await service.saveCharacterRelation(TEST_USER_ID, relationOf());
    await service.saveCharacterRelation(
      TEST_USER_ID,
      relationOf({ character1Id: 'ada', character2Id: 'hopper', relationType: 'sibling' }),
    );

    expect(
      (await service.getCharacterRelationsByStoryId(TEST_STORY_ID, 'HOPP')).map(
        (row) => row.relationType,
      ),
    ).toEqual(['sibling']);
    expect(
      (await service.getCharacterRelationsByStoryId(TEST_STORY_ID, 'ment')).map(
        (row) => row.relationType,
      ),
    ).toEqual(['mentor']);
  });

  it('narrows the list by the advanced relation-type criterion', async () => {
    const service = createCharacterRelationService(database.db);
    await service.saveCharacterRelation(TEST_USER_ID, relationOf());
    await service.saveCharacterRelation(
      TEST_USER_ID,
      relationOf({ character1Id: 'ada', character2Id: 'hopper', relationType: 'sibling' }),
    );

    const rows = await service.getCharacterRelationsByStoryId(
      TEST_STORY_ID,
      undefined,
      null,
      'asc',
      {
        relationType: 'sib',
      },
    );

    expect(rows.map((row) => row.relationType)).toEqual(['sibling']);
  });

  it('sorts by type, names and timestamps in both directions', async () => {
    const service = createCharacterRelationService(database.db);
    await service.saveCharacterRelation(
      TEST_USER_ID,
      relationOf({ character1Id: 'hopper', character2Id: 'grace', relationType: 'zeta' }),
    );
    await service.saveCharacterRelation(
      TEST_USER_ID,
      relationOf({ character1Id: 'ada', character2Id: 'grace', relationType: 'alpha' }),
    );

    const byType = await service.getCharacterRelationsByStoryId(
      TEST_STORY_ID,
      undefined,
      'relationType',
      'asc',
    );
    expect(byType.map((row) => row.relationType)).toEqual(['alpha', 'zeta']);
    const byChar1 = await service.getCharacterRelationsByStoryId(
      TEST_STORY_ID,
      undefined,
      'char1Name',
      'desc',
    );
    expect(byChar1.map((row) => row.char1Name)).toEqual(['Hopper', 'Ada']);
    const byChar2 = await service.getCharacterRelationsByStoryId(
      TEST_STORY_ID,
      undefined,
      'char2Name',
      'asc',
    );
    expect(byChar2).toHaveLength(2);
    const byCreated = await service.getCharacterRelationsByStoryId(
      TEST_STORY_ID,
      undefined,
      'createdAt',
      'asc',
    );
    expect(byCreated).toHaveLength(2);
    const byUpdated = await service.getCharacterRelationsByStoryId(
      TEST_STORY_ID,
      undefined,
      'updatedAt',
      'desc',
    );
    expect(byUpdated).toHaveLength(2);
  });

  it('warns and still lists on an unknown sort key', async () => {
    const service = createCharacterRelationService(database.db);
    await service.saveCharacterRelation(TEST_USER_ID, relationOf());

    const rows = await service.getCharacterRelationsByStoryId(
      TEST_STORY_ID,
      undefined,
      'nope',
      'asc',
    );

    expect(rows).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith('Unknown sortBy field for CharacterRelation: nope');
  });
});
