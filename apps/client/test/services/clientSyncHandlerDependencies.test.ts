/** @jest-environment node */
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import * as schema from '../../src/db/schema';
import { ChoiceCheckClientSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceCheckClientSyncHandler';
import { ChoiceCheckGroupClientSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceCheckGroupClientSyncHandler';
import { ItemJourneyClientSyncHandler } from '../../src/services/entity-sync-handlers/ItemJourneyClientSyncHandler';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');
const entityBase = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };
let database: TestDatabase;

const createUpdate = (entity: string, id: string, data: unknown) =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;
const updateUpdate = (entity: string, id: string, changes: unknown) =>
  ({ type: 'update', entity, id, changes }) as UpdateStoryUpdate;
const deleteUpdate = (entity: string, id: string) =>
  ({ type: 'delete', entity, id }) as DeleteStoryUpdate;

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await database.db.insert(schema.choices).values({
    id: 'choice-1',
    storyId: STORY_ID,
    sceneId: 'scene-1',
    nextSceneId: 'scene-2',
    text: 'Continuar',
    ...entityBase,
  });
  await database.db.insert(schema.items).values({
    id: 'item-1',
    storyId: STORY_ID,
    name: 'Chave',
    ...entityBase,
  });
  await database.db.insert(schema.scenes).values({
    id: 'scene-1',
    storyId: STORY_ID,
    chapterId: 'chapter-1',
    locationId: 'location-1',
    name: 'Chegada',
    index: 0,
    ...entityBase,
  });
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('dependent client sync handlers', () => {
  it('persists and tombstones a choice check group under its existing choice', async () => {
    const handler = new ChoiceCheckGroupClientSyncHandler();
    handler.setDb(database.db);
    const group = {
      id: 'group-1',
      storyId: STORY_ID,
      choiceId: 'choice-1',
      combinator: 'AND',
      order: 0,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };

    await handler.applyCreate(STORY_ID, createUpdate('ChoiceCheckGroup', group.id, group));
    await handler.applyUpdate(STORY_ID, updateUpdate('ChoiceCheckGroup', group.id, { order: 1 }));
    await handler.applyDelete(STORY_ID, deleteUpdate('ChoiceCheckGroup', group.id));

    expect(await handler.getById(group.id)).toEqual(
      expect.objectContaining({ choiceId: 'choice-1', order: 1, isDeleted: true }),
    );
  });

  it('persists and tombstones a choice check under its existing group', async () => {
    await database.db.insert(schema.choiceCheckGroups).values({
      id: 'group-1',
      storyId: STORY_ID,
      choiceId: 'choice-1',
      combinator: 'AND',
      order: 0,
      ...entityBase,
    });
    const handler = new ChoiceCheckClientSyncHandler();
    handler.setDb(database.db);
    const check = {
      id: 'check-1',
      storyId: STORY_ID,
      groupId: 'group-1',
      mode: 'block',
      type: 'trigger',
      order: 0,
      triggerName: 'portao_aberto',
      triggerState: 'set',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };

    await handler.applyCreate(STORY_ID, createUpdate('ChoiceCheck', check.id, check));
    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('ChoiceCheck', check.id, { triggerState: 'unset' }),
    );
    await handler.applyDelete(STORY_ID, deleteUpdate('ChoiceCheck', check.id));

    expect(await handler.getById(check.id)).toEqual(
      expect.objectContaining({ triggerState: 'unset', isDeleted: true }),
    );
  });

  it('persists and tombstones an item journey only when its item and scene exist', async () => {
    const handler = new ItemJourneyClientSyncHandler();
    handler.setDb(database.db);
    const journey = {
      id: 'journey-1',
      storyId: STORY_ID,
      itemId: 'item-1',
      sceneId: 'scene-1',
      newCharacterOwnerId: null,
      newState: 'obtida',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };

    await handler.applyCreate(STORY_ID, createUpdate('ItemJourney', journey.id, journey));
    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('ItemJourney', journey.id, { newState: 'usada' }),
    );
    await handler.applyDelete(STORY_ID, deleteUpdate('ItemJourney', journey.id));

    expect(await handler.getById(journey.id)).toEqual(
      expect.objectContaining({
        itemId: 'item-1',
        sceneId: 'scene-1',
        newState: 'usada',
        isDeleted: true,
      }),
    );
  });
});
