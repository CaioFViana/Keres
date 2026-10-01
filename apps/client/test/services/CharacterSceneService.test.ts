/**
 * @jest-environment node
 */
import type { CharacterScene } from '@keres/shared/entities/CharacterScene';
import * as schema from '../../src/db/schema';
import {
  createCharacterSceneService,
  type SaveCharacterScene,
} from '../../src/services/storymanagement/CharacterSceneService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The character-scene presence service: who is in which scene.
 *
 * Presence drives the scene screen's cast list and the character screen's appearances, so the
 * pair rule (one live row per character/scene pair) has to hold in both directions of the save:
 * on insert and on update, the latter excluding the row being edited. The update path also
 * carries the no-op skip, because the presence toggle writes through here on every tap.
 *
 * The catch blocks and the "the write returned no row" throws are deliberately not covered: they
 * need the database to fail or the row to vanish mid-call.
 */

let database: TestDatabase;

const relationOf = (overrides: Partial<SaveCharacterScene> = {}): SaveCharacterScene => ({
  storyId: TEST_STORY_ID,
  characterId: 'ada',
  sceneId: 'scene-1',
  ...overrides,
});

const operationsFor = async (entityId: string) =>
  (await database.db.query.operationLogs.findMany()).filter(
    (operation) => operation.entityId === entityId,
  );

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.characters).values({
    id: 'ada',
    storyId: TEST_STORY_ID,
    name: 'Ada',
    ...entityBase,
  });
  await database.db.insert(schema.scenes).values({
    id: 'scene-1',
    storyId: TEST_STORY_ID,
    name: 'Arrival',
    index: 1,
    ...entityBase,
    deletedAt: null,
  });
  await database.db.insert(schema.scenes).values({
    id: 'scene-2',
    storyId: TEST_STORY_ID,
    name: 'Departure',
    index: 2,
    ...entityBase,
    deletedAt: null,
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('CharacterSceneService reads', () => {
  it('lists presence from the scene side, the character side and the story side', async () => {
    const service = createCharacterSceneService(database.db);
    const created = await service.saveCharacterScene(TEST_USER_ID, relationOf());

    expect(
      (await service.getRelationsForScene(TEST_STORY_ID, 'scene-1')).map((relation) => relation.id),
    ).toEqual([created.id]);
    expect(
      (await service.getRelationsForCharacter(TEST_STORY_ID, 'ada')).map((relation) => relation.id),
    ).toEqual([created.id]);
    expect(
      (await service.getRelationsByStoryId(TEST_STORY_ID)).map((relation) => relation.id),
    ).toEqual([created.id]);

    await service.deleteCharacterScene(TEST_USER_ID, created.id);

    expect(await service.getRelationsForScene(TEST_STORY_ID, 'scene-1')).toEqual([]);
    expect(await service.getRelationsByStoryId(TEST_STORY_ID)).toEqual([]);
  });
});

describe('CharacterSceneService save', () => {
  it('rejects a second live row for the same pair', async () => {
    const service = createCharacterSceneService(database.db);
    await service.saveCharacterScene(TEST_USER_ID, relationOf());

    await expect(service.saveCharacterScene(TEST_USER_ID, relationOf())).rejects.toThrow(
      'already exists',
    );
  });

  it('moves a presence to another scene through the update path', async () => {
    const service = createCharacterSceneService(database.db);
    const created = await service.saveCharacterScene(TEST_USER_ID, relationOf());

    const updated: CharacterScene = await service.saveCharacterScene(
      TEST_USER_ID,
      relationOf({ id: created.id, sceneId: 'scene-2' }),
    );

    expect(updated.sceneId).toBe('scene-2');
    expect(await service.getRelationsForScene(TEST_STORY_ID, 'scene-1')).toEqual([]);
    expect(
      (await service.getRelationsForScene(TEST_STORY_ID, 'scene-2')).map((relation) => relation.id),
    ).toEqual([created.id]);
    expect((await operationsFor(created.id)).map((operation) => operation.operationType)).toEqual([
      'create',
      'update',
    ]);
  });

  it('rejects an update that would collide with another pair', async () => {
    const service = createCharacterSceneService(database.db);
    await service.saveCharacterScene(TEST_USER_ID, relationOf());
    const second = await service.saveCharacterScene(
      TEST_USER_ID,
      relationOf({ sceneId: 'scene-2' }),
    );

    await expect(
      service.saveCharacterScene(TEST_USER_ID, relationOf({ id: second.id })),
    ).rejects.toThrow('already exists');
  });

  it('skips the write and the operation log when the update changes nothing', async () => {
    const service = createCharacterSceneService(database.db);
    const created = await service.saveCharacterScene(TEST_USER_ID, relationOf());
    const stored = await database.db.query.characterScenes.findFirst({
      where: (table, { eq }) => eq(table.id, created.id),
    });

    const result = await service.saveCharacterScene(TEST_USER_ID, {
      id: stored!.id,
      storyId: stored!.storyId,
      characterId: stored!.characterId,
      sceneId: stored!.sceneId,
    });

    expect(result.id).toBe(created.id);
    expect(await operationsFor(created.id)).toHaveLength(1);
  });

  it('inserts a fresh row when the given id does not exist', async () => {
    const service = createCharacterSceneService(database.db);

    const created = await service.saveCharacterScene(
      TEST_USER_ID,
      relationOf({ id: 'unknown-id' }),
    );

    expect(created.id).not.toBe('unknown-id');
    expect(await operationsFor(created.id)).toHaveLength(1);
  });
});

describe('CharacterSceneService delete', () => {
  it('tombstones the row with a delete operation', async () => {
    const service = createCharacterSceneService(database.db);
    const created = await service.saveCharacterScene(TEST_USER_ID, relationOf());

    expect(await service.deleteCharacterScene(TEST_USER_ID, created.id)).toBe(true);

    const stored = await database.db.query.characterScenes.findFirst({
      where: (table, { eq }) => eq(table.id, created.id),
    });
    expect(stored).toMatchObject({ isDeleted: true, version: 2 });
    expect((await operationsFor(created.id)).map((operation) => operation.operationType)).toEqual([
      'create',
      'delete',
    ]);
  });

  it('reports a missing row on delete instead of throwing', async () => {
    const service = createCharacterSceneService(database.db);

    expect(await service.deleteCharacterScene(TEST_USER_ID, 'missing')).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      'CharacterScene with ID missing not found for deletion.',
    );
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });
});
