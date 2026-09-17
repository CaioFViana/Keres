/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createChoiceCheckGroupService } from '../../src/services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../../src/services/storymanagement/ChoiceCheckService';
import { createEffectService } from '../../src/services/storymanagement/EffectService';
import { createItemJourneyService } from '../../src/services/storymanagement/ItemJourneyService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The mechanic services' shared edges: whole-story reads, unknown-id updates, updates of
 * tombstoned rows, and quiet deletes of unknown ids.
 *
 * Effects, choice checks, check groups and item journeys share one implementation shape, and the
 * happy paths already live in `choiceMechanicServices.test.ts`. The edges matter because a sync
 * pull and a stale form both reach them: updating a row the other device just deleted must fail
 * loudly (so the caller can reconcile) while deleting an unknown id stays quiet (a replayed
 * delete is not an error).
 */

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.choices).values({
    id: 'choice-1',
    storyId: TEST_STORY_ID,
    sceneId: 'from',
    nextSceneId: 'to',
    text: 'Go',
    ...entityBase,
    deletedAt: null,
  });
  await database.db.insert(schema.choiceCheckGroups).values({
    id: 'group-1',
    storyId: TEST_STORY_ID,
    choiceId: 'choice-1',
    combinator: 'AND',
    order: 1,
    ...entityBase,
    deletedAt: null,
  });
  await database.db.insert(schema.items).values({
    id: 'compass',
    storyId: TEST_STORY_ID,
    name: 'Compass',
    ...entityBase,
    deletedAt: null,
  });
  await database.db.insert(schema.scenes).values({
    id: 'market',
    storyId: TEST_STORY_ID,
    name: 'Market',
    index: 1,
    ...entityBase,
    deletedAt: null,
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('mechanic service story reads', () => {
  it('lists every live row of the story for effects, checks, groups and journeys', async () => {
    const effects = createEffectService(database.db);
    const checks = createChoiceCheckService(database.db);
    const groups = createChoiceCheckGroupService(database.db);
    const journeys = createItemJourneyService(database.db);

    const effect = await effects.createEffect(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      entityType: 'Scene',
      entityId: 'market',
      effectType: 'triggerSet',
      itemId: null,
      triggerName: 'visited',
    });
    const check = await checks.createChoiceCheck(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      groupId: 'group-1',
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
    const group = await groups.createChoiceCheckGroup(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      choiceId: 'choice-1',
      combinator: 'OR',
      order: 2,
    });
    const journey = await journeys.createItemJourney(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      itemId: 'compass',
      sceneId: 'market',
      newState: 'found',
      newCharacterOwnerId: null,
      extraNotes: null,
    });

    expect((await effects.getAllByStoryId(TEST_STORY_ID)).map((row) => row.id)).toEqual([
      effect.id,
    ]);
    expect((await checks.getAllByStoryId(TEST_STORY_ID)).map((row) => row.id)).toEqual([check.id]);
    expect((await groups.getAllByStoryId(TEST_STORY_ID)).map((row) => row.id).sort()).toEqual(
      ['group-1', group.id].sort(),
    );
    expect((await journeys.getAllByStoryId(TEST_STORY_ID)).map((row) => row.id)).toEqual([
      journey.id,
    ]);
  });
});

describe('mechanic service update edges', () => {
  it('refuses to update a row that does not exist', async () => {
    await expect(
      createEffectService(database.db).updateEffect(TEST_USER_ID, 'missing', {
        triggerName: 'x',
      }),
    ).rejects.toThrow('not found for update');
    await expect(
      createChoiceCheckService(database.db).updateChoiceCheck(TEST_USER_ID, 'missing', {
        order: 2,
      }),
    ).rejects.toThrow('not found for update');
    await expect(
      createChoiceCheckGroupService(database.db).updateChoiceCheckGroup(TEST_USER_ID, 'missing', {
        order: 2,
      }),
    ).rejects.toThrow('not found for update');
    await expect(
      createItemJourneyService(database.db).updateItemJourney(TEST_USER_ID, 'missing', {
        newState: 'lost',
      }),
    ).rejects.toThrow('not found for update');
  });

  it('refuses to update a row that was already deleted', async () => {
    const effects = createEffectService(database.db);
    const effect = await effects.createEffect(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      entityType: 'Scene',
      entityId: 'market',
      effectType: 'triggerSet',
      itemId: null,
      triggerName: 'visited',
    });
    await effects.deleteEffect(TEST_USER_ID, effect.id);

    await expect(
      effects.updateEffect(TEST_USER_ID, effect.id, { triggerName: 'x' }),
    ).rejects.toThrow('not found or already deleted');

    const checks = createChoiceCheckService(database.db);
    const check = await checks.createChoiceCheck(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      groupId: 'group-1',
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
    await checks.deleteChoiceCheck(TEST_USER_ID, check.id);
    await expect(checks.updateChoiceCheck(TEST_USER_ID, check.id, { order: 2 })).rejects.toThrow(
      'not found or already deleted',
    );

    const groups = createChoiceCheckGroupService(database.db);
    const group = await groups.createChoiceCheckGroup(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      choiceId: 'choice-1',
      combinator: 'AND',
      order: 3,
    });
    await groups.deleteChoiceCheckGroup(TEST_USER_ID, group.id);
    await expect(
      groups.updateChoiceCheckGroup(TEST_USER_ID, group.id, { order: 4 }),
    ).rejects.toThrow('not found or already deleted');

    const journeys = createItemJourneyService(database.db);
    const journey = await journeys.createItemJourney(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      itemId: 'compass',
      sceneId: 'market',
      newState: 'found',
      newCharacterOwnerId: null,
      extraNotes: null,
    });
    await journeys.deleteItemJourney(TEST_USER_ID, journey.id);
    await expect(
      journeys.updateItemJourney(TEST_USER_ID, journey.id, { newState: 'lost' }),
    ).rejects.toThrow('not found or already deleted');
  });
});

describe('mechanic service delete edges', () => {
  it('warns and stays quiet when deleting a row that does not exist', async () => {
    await createEffectService(database.db).deleteEffect(TEST_USER_ID, 'missing');
    await createChoiceCheckService(database.db).deleteChoiceCheck(TEST_USER_ID, 'missing');
    await createChoiceCheckGroupService(database.db).deleteChoiceCheckGroup(
      TEST_USER_ID,
      'missing',
    );
    await createItemJourneyService(database.db).deleteItemJourney(TEST_USER_ID, 'missing');

    expect(console.warn).toHaveBeenCalledWith('Attempted to delete non-existent Effect missing.');
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });
});
