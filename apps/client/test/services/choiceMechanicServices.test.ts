/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createCharacterSceneService } from '../../src/services/storymanagement/CharacterSceneService';
import { createChoiceCheckGroupService } from '../../src/services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../../src/services/storymanagement/ChoiceCheckService';
import { createEffectService } from '../../src/services/storymanagement/EffectService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('choice and scene mechanic services', () => {
  it('sorts ChoiceCheckGroupService groups by explicit order and hides tombstones', async () => {
    await database.db.insert(schema.choices).values({
      id: 'choice',
      storyId: TEST_STORY_ID,
      sceneId: 'from',
      nextSceneId: 'to',
      text: 'Avançar',
      ...entityBase,
    });
    await database.db.insert(schema.choiceCheckGroups).values([
      {
        id: 'second',
        storyId: TEST_STORY_ID,
        choiceId: 'choice',
        combinator: 'OR',
        order: 2,
        ...entityBase,
      },
      {
        id: 'first',
        storyId: TEST_STORY_ID,
        choiceId: 'choice',
        combinator: 'AND',
        order: 1,
        ...entityBase,
      },
      {
        id: 'deleted',
        storyId: TEST_STORY_ID,
        choiceId: 'choice',
        combinator: 'AND',
        order: 0,
        ...entityBase,
        isDeleted: true,
      },
    ]);

    expect(
      (
        await createChoiceCheckGroupService(database.db).getChoiceCheckGroupsByChoiceId(
          TEST_STORY_ID,
          'choice',
        )
      ).map(({ id }) => id),
    ).toEqual(['first', 'second']);
  });

  it('scopes ChoiceCheckService checks to the requested group in their configured order', async () => {
    await database.db.insert(schema.choices).values({
      id: 'choice',
      storyId: TEST_STORY_ID,
      sceneId: 'from',
      nextSceneId: 'to',
      text: 'Avançar',
      ...entityBase,
    });
    await database.db.insert(schema.choiceCheckGroups).values([
      {
        id: 'group',
        storyId: TEST_STORY_ID,
        choiceId: 'choice',
        combinator: 'AND',
        order: 1,
        ...entityBase,
      },
      {
        id: 'other-group',
        storyId: TEST_STORY_ID,
        choiceId: 'choice',
        combinator: 'AND',
        order: 2,
        ...entityBase,
      },
    ]);
    await database.db.insert(schema.choiceChecks).values([
      {
        id: 'late',
        storyId: TEST_STORY_ID,
        groupId: 'group',
        mode: 'enable',
        type: 'trigger',
        triggerName: 'key',
        triggerState: 'set',
        order: 2,
        ...entityBase,
      },
      {
        id: 'early',
        storyId: TEST_STORY_ID,
        groupId: 'group',
        mode: 'block',
        type: 'trigger',
        triggerName: 'alarm',
        triggerState: 'set',
        order: 1,
        ...entityBase,
      },
      {
        id: 'other',
        storyId: TEST_STORY_ID,
        groupId: 'other-group',
        mode: 'block',
        type: 'trigger',
        triggerName: 'ignored',
        triggerState: 'set',
        order: 0,
        ...entityBase,
      },
    ]);

    expect(
      (
        await createChoiceCheckService(database.db).getChoiceChecksByGroupId(TEST_STORY_ID, 'group')
      ).map(({ id }) => id),
    ).toEqual(['early', 'late']);
  });

  it('returns EffectService effects only for the requested scene or choice', async () => {
    await database.db.insert(schema.effects).values([
      {
        id: 'scene-effect',
        storyId: TEST_STORY_ID,
        entityType: 'Scene',
        entityId: 'market',
        effectType: 'triggerSet',
        triggerName: 'marketVisited',
        ...entityBase,
      },
      {
        id: 'choice-effect',
        storyId: TEST_STORY_ID,
        entityType: 'Choice',
        entityId: 'choice',
        effectType: 'triggerUnset',
        triggerName: 'marketVisited',
        ...entityBase,
      },
      {
        id: 'deleted-effect',
        storyId: TEST_STORY_ID,
        entityType: 'Scene',
        entityId: 'market',
        effectType: 'triggerSet',
        triggerName: 'hidden',
        ...entityBase,
        isDeleted: true,
      },
    ]);

    const service = createEffectService(database.db);
    expect(
      (await service.getEffectsByEntity(TEST_STORY_ID, 'Scene', 'market')).map(({ id }) => id),
    ).toEqual(['scene-effect']);
    expect(
      (await service.getEffectsByEntity(TEST_STORY_ID, 'Choice', 'choice')).map(({ id }) => id),
    ).toEqual(['choice-effect']);
  });

  it('keeps CharacterSceneService relations scoped by scene, character, and story', async () => {
    await database.db.insert(schema.characterScenes).values([
      {
        id: 'ada-market',
        storyId: TEST_STORY_ID,
        characterId: 'ada',
        sceneId: 'market',
        ...entityBase,
      },
      {
        id: 'ada-tower',
        storyId: TEST_STORY_ID,
        characterId: 'ada',
        sceneId: 'tower',
        ...entityBase,
      },
      {
        id: 'grace-market',
        storyId: TEST_STORY_ID,
        characterId: 'grace',
        sceneId: 'market',
        ...entityBase,
      },
      {
        id: 'deleted-relation',
        storyId: TEST_STORY_ID,
        characterId: 'ada',
        sceneId: 'market',
        ...entityBase,
        isDeleted: true,
      },
    ]);

    const service = createCharacterSceneService(database.db);
    expect(
      (await service.getRelationsForScene(TEST_STORY_ID, 'market')).map(({ id }) => id).sort(),
    ).toEqual(['ada-market', 'grace-market']);
    expect(
      (await service.getRelationsForCharacter(TEST_STORY_ID, 'ada')).map(({ id }) => id).sort(),
    ).toEqual(['ada-market', 'ada-tower']);
  });

  it('persists EffectService changes and removes the effect from live queries on deletion', async () => {
    const service = createEffectService(database.db);
    const created = await service.createEffect('local-user', {
      storyId: TEST_STORY_ID,
      entityType: 'Scene',
      entityId: 'market',
      effectType: 'triggerSet',
      itemId: null,
      triggerName: 'visited',
    });
    const updated = await service.updateEffect('local-user', created.id, {
      triggerName: 'marketVisited',
    });
    await service.deleteEffect('local-user', created.id);

    expect(updated).toEqual(expect.objectContaining({ triggerName: 'marketVisited', version: 2 }));
    expect(await service.getById(created.id)).toBeUndefined();
  });

  it('creates a CharacterScene relation once and soft-deletes it when requested', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const service = createCharacterSceneService(database.db);
    const created = await service.saveCharacterScene('local-user', {
      storyId: TEST_STORY_ID,
      characterId: 'ada',
      sceneId: 'market',
    });

    await expect(
      service.saveCharacterScene('local-user', {
        storyId: TEST_STORY_ID,
        characterId: 'ada',
        sceneId: 'market',
      }),
    ).rejects.toThrow('already exists');
    await expect(service.deleteCharacterScene('local-user', created.id)).resolves.toBe(true);
    expect(await service.getRelationsForScene(TEST_STORY_ID, 'market')).toEqual([]);
  });

  it('writes ChoiceCheckGroupService groups and excludes the deleted group from lookups', async () => {
    await database.db.insert(schema.choices).values({
      id: 'choice-for-group',
      storyId: TEST_STORY_ID,
      sceneId: 'from',
      nextSceneId: 'to',
      text: 'Continuar',
      ...entityBase,
    });
    const service = createChoiceCheckGroupService(database.db);
    const created = await service.createChoiceCheckGroup('local-user', {
      storyId: TEST_STORY_ID,
      choiceId: 'choice-for-group',
      combinator: 'AND',
      order: 1,
    });
    const updated = await service.updateChoiceCheckGroup('local-user', created.id, {
      combinator: 'OR',
      order: 2,
    });
    await service.deleteChoiceCheckGroup('local-user', created.id);

    expect(updated).toEqual(expect.objectContaining({ combinator: 'OR', order: 2, version: 2 }));
    expect(await service.getById(created.id)).toBeUndefined();
  });

  it('writes ChoiceCheckService checks and excludes the deleted check from lookups', async () => {
    await database.db.insert(schema.choices).values({
      id: 'choice-for-check',
      storyId: TEST_STORY_ID,
      sceneId: 'from',
      nextSceneId: 'to',
      text: 'Continuar',
      ...entityBase,
    });
    await database.db.insert(schema.choiceCheckGroups).values({
      id: 'group-for-check',
      storyId: TEST_STORY_ID,
      choiceId: 'choice-for-check',
      combinator: 'AND',
      order: 1,
      ...entityBase,
    });
    const service = createChoiceCheckService(database.db);
    const created = await service.createChoiceCheck('local-user', {
      storyId: TEST_STORY_ID,
      groupId: 'group-for-check',
      mode: 'block',
      type: 'trigger',
      order: 1,
      sceneId: null,
      minVisits: null,
      itemId: null,
      itemPresence: null,
      triggerName: 'doorOpened',
      triggerState: 'unset',
    });
    const updated = await service.updateChoiceCheck('local-user', created.id, { order: 3 });
    await service.deleteChoiceCheck('local-user', created.id);

    expect(updated).toEqual(expect.objectContaining({ order: 3, version: 2 }));
    expect(await service.getById(created.id)).toBeUndefined();
  });
});
