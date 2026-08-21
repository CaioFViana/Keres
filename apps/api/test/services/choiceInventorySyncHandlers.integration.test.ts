import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { ChapterSyncHandler } from '../../src/services/entity-sync-handlers/ChapterSyncHandler';
import { ChoiceCheckGroupSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceCheckGroupSyncHandler';
import { ChoiceCheckSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceCheckSyncHandler';
import { ChoiceSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceSyncHandler';
import { EffectSyncHandler } from '../../src/services/entity-sync-handlers/EffectSyncHandler';
import { ItemSyncHandler } from '../../src/services/entity-sync-handlers/ItemSyncHandler';
import { LocationSyncHandler } from '../../src/services/entity-sync-handlers/LocationSyncHandler';
import { SceneSyncHandler } from '../../src/services/entity-sync-handlers/SceneSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;
let firstSceneId: string;
let secondSceneId: string;

const create = (entity: string, id: string, data: Record<string, unknown>) =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;
const remove = (entity: string, id: string, version: number) =>
  ({ type: 'delete', entity, id, version }) as DeleteStoryUpdate;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  const now = new Date();
  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({
    id: storyId,
    userId,
    title: 'A Queda',
    type: 'branching',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);

  const chapterId = newId();
  const locationId = newId();
  firstSceneId = newId();
  secondSceneId = newId();
  await new ChapterSyncHandler().create(
    userId,
    storyId,
    create('Chapter', chapterId, {
      name: 'Prólogo',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
    }),
  );
  await new LocationSyncHandler().create(
    userId,
    storyId,
    create('Location', locationId, {
      name: 'Olímpo',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
    }),
  );
  const scenes = new SceneSyncHandler();
  await scenes.create(
    userId,
    storyId,
    create('Scene', firstSceneId, {
      chapterId,
      locationId,
      name: 'Chegada',
      index: 0,
      summary: null,
      gap: null,
      gapType: null,
      duration: null,
      durationType: null,
      isStart: true,
      isFinish: false,
      isFavorite: false,
      extraNotes: null,
    }),
  );
  await scenes.create(
    userId,
    storyId,
    create('Scene', secondSceneId, {
      chapterId,
      locationId,
      name: 'Partida',
      index: 1,
      summary: null,
      gap: null,
      gapType: null,
      duration: null,
      durationType: null,
      isStart: false,
      isFinish: true,
      isFavorite: false,
      extraNotes: null,
    }),
  );
});

describe('choice and inventory sync entity handlers', () => {
  it('persists an item effect and a branching choice with its checks', async () => {
    const item = new ItemSyncHandler();
    const effect = new EffectSyncHandler();
    const choice = new ChoiceSyncHandler();
    const group = new ChoiceCheckGroupSyncHandler();
    const check = new ChoiceCheckSyncHandler();
    const itemId = newId();
    const effectId = newId();
    const choiceId = newId();
    const groupId = newId();
    const checkId = newId();

    await item.create(
      userId,
      storyId,
      create('Item', itemId, {
        characterOwnerId: null,
        name: 'Chave de ônix',
        category: 'chave',
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
    );
    await effect.create(
      userId,
      storyId,
      create('Effect', effectId, {
        entityType: 'Scene',
        entityId: firstSceneId,
        effectType: 'itemGrant',
        itemId,
        triggerName: null,
      }),
    );
    await choice.create(
      userId,
      storyId,
      create('Choice', choiceId, {
        sceneId: firstSceneId,
        nextSceneId: secondSceneId,
        text: 'Abrir o portão',
        notes: null,
      }),
    );
    await group.create(
      userId,
      storyId,
      create('ChoiceCheckGroup', groupId, { choiceId, combinator: 'AND', order: 0 }),
    );
    await check.create(
      userId,
      storyId,
      create('ChoiceCheck', checkId, {
        groupId,
        mode: 'enable',
        type: 'inventory',
        order: 0,
        sceneId: null,
        minVisits: null,
        itemId,
        itemPresence: 'has',
        triggerName: null,
        triggerState: null,
      }),
    );

    expect(await item.findById(itemId)).toMatchObject({ name: 'Chave de ônix', version: 1 });
    expect(await effect.findById(effectId)).toMatchObject({
      entityId: firstSceneId,
      itemId,
      effectType: 'itemGrant',
    });
    expect(await choice.findById(choiceId)).toMatchObject({
      sceneId: firstSceneId,
      nextSceneId: secondSceneId,
    });
    expect(await group.findById(groupId)).toMatchObject({ choiceId, combinator: 'AND' });
    expect(await check.findById(checkId)).toMatchObject({
      groupId,
      itemId,
      itemPresence: 'has',
      mode: 'enable',
    });

    const currentChoice = await choice.findById(choiceId);
    await choice.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'Choice',
        id: choiceId,
        changes: { text: 'Usar a chave', version: 1 },
      } as UpdateStoryUpdate,
      currentChoice,
    );
    expect(await choice.findById(choiceId)).toMatchObject({ text: 'Usar a chave', version: 2 });

    for (const [entity, id, handler] of [
      ['ChoiceCheck', checkId, check],
      ['ChoiceCheckGroup', groupId, group],
      ['Choice', choiceId, choice],
      ['Effect', effectId, effect],
      ['Item', itemId, item],
    ] as const) {
      const current = await handler.findById(id);
      await handler.delete(userId, storyId, remove(entity, id, current.version), current);
      expect(await handler.findById(id)).toMatchObject({ isDeleted: true });
    }
  });

  /**
   * Scene and Choice used to reimplement `update()` with a raw version-matched query that had
   * no `checkVersionConflict`, no `deleted_on_server` check, and used server time instead of
   * the client's `operationTime` - a concurrent edit landed with no error and no conflict
   * reported, just silently dropped. Both now delegate to the base class; these guard against
   * that regressing (same contract already covered for Note/WorldRule elsewhere).
   */
  it('a Scene reports a version conflict instead of silently dropping a concurrent edit', async () => {
    const scenes = new SceneSyncHandler();
    const current = await scenes.findById(firstSceneId);

    const stale = scenes.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'Scene',
        id: firstSceneId,
        changes: { name: 'Nome que não deveria gravar', version: 99 },
      } as UpdateStoryUpdate,
      current,
    );

    await expect(stale).rejects.toMatchObject({ reason: 'version_conflict' });
    expect((await scenes.findById(firstSceneId)).name).toBe('Chegada');
  });

  it('a Choice reports a version conflict instead of silently dropping a concurrent edit', async () => {
    const choice = new ChoiceSyncHandler();
    const choiceId = newId();
    await choice.create(
      userId,
      storyId,
      create('Choice', choiceId, {
        sceneId: firstSceneId,
        nextSceneId: secondSceneId,
        text: 'Abrir o portão',
        notes: null,
      }),
    );
    const current = await choice.findById(choiceId);

    const stale = choice.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'Choice',
        id: choiceId,
        changes: { text: 'Texto que não deveria gravar', version: 99 },
      } as UpdateStoryUpdate,
      current,
    );

    await expect(stale).rejects.toMatchObject({ reason: 'version_conflict' });
    expect((await choice.findById(choiceId)).text).toBe('Abrir o portão');
  });
});
