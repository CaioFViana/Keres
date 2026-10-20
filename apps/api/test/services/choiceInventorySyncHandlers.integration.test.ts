import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '@/db';
import { stories, users } from '@/db/schema';
import { ChapterSyncHandler } from '@/services/entity-sync-handlers/ChapterSyncHandler';
import { ChoiceCheckGroupSyncHandler } from '@/services/entity-sync-handlers/ChoiceCheckGroupSyncHandler';
import { ChoiceCheckSyncHandler } from '@/services/entity-sync-handlers/ChoiceCheckSyncHandler';
import { ChoiceSyncHandler } from '@/services/entity-sync-handlers/ChoiceSyncHandler';
import { EffectSyncHandler } from '@/services/entity-sync-handlers/EffectSyncHandler';
import { ItemSyncHandler } from '@/services/entity-sync-handlers/ItemSyncHandler';
import { LocationSyncHandler } from '@/services/entity-sync-handlers/LocationSyncHandler';
import { SceneSyncHandler } from '@/services/entity-sync-handlers/SceneSyncHandler';
import type { SyncEntityHandler } from '@/services/entity-sync-handlers/BaseSyncEntityHandler';
import { newId } from '@test/helpers/app';
import { truncateAll } from '@test/helpers/database';

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
    create('Chapter', chapterId, {
      name: 'Prólogo',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
    }),
    { userId, storyId },
  );
  await new LocationSyncHandler().create(
    create('Location', locationId, {
      name: 'Olímpo',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
    }),
    { userId, storyId },
  );
  const scenes = new SceneSyncHandler();
  await scenes.create(
    create('Scene', firstSceneId, {
      chapterId,
      locationId,
      name: 'Chegada',
      index: 1,
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
    { userId, storyId },
  );
  await scenes.create(
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
    { userId, storyId },
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
      create('Item', itemId, {
        characterOwnerId: null,
        name: 'Chave de ônix',
        category: 'chave',
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
      { userId, storyId },
    );
    await effect.create(
      create('Effect', effectId, {
        entityType: 'Scene',
        entityId: firstSceneId,
        effectType: 'itemGrant',
        itemId,
        triggerName: null,
      }),
      { userId, storyId },
    );
    await choice.create(
      create('Choice', choiceId, {
        sceneId: firstSceneId,
        nextSceneId: secondSceneId,
        text: 'Abrir o portão',
        notes: null,
      }),
      { userId, storyId },
    );
    await group.create(
      create('ChoiceCheckGroup', groupId, { choiceId, combinator: 'AND', order: 0 }),
      { userId, storyId },
    );
    await check.create(
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
      { userId, storyId },
    );

    expect(await item.findByIdOrThrow(itemId)).toMatchObject({ name: 'Chave de ônix', version: 1 });
    expect(await effect.findByIdOrThrow(effectId)).toMatchObject({
      entityId: firstSceneId,
      itemId,
      effectType: 'itemGrant',
    });
    expect(await choice.findByIdOrThrow(choiceId)).toMatchObject({
      sceneId: firstSceneId,
      nextSceneId: secondSceneId,
    });
    expect(await group.findByIdOrThrow(groupId)).toMatchObject({ choiceId, combinator: 'AND' });
    expect(await check.findByIdOrThrow(checkId)).toMatchObject({
      groupId,
      itemId,
      itemPresence: 'has',
      mode: 'enable',
    });

    const currentChoice = await choice.findByIdOrThrow(choiceId);
    await choice.update(
      {
        type: 'update',
        entity: 'Choice',
        id: choiceId,
        changes: { text: 'Usar a chave', version: 1 },
      } as UpdateStoryUpdate,
      currentChoice,
      { userId, storyId },
    );
    expect(await choice.findByIdOrThrow(choiceId)).toMatchObject({
      text: 'Usar a chave',
      version: 2,
    });

    const deletionCases: Array<[string, string, SyncEntityHandler]> = [
      ['ChoiceCheck', checkId, check],
      ['ChoiceCheckGroup', groupId, group],
      ['Choice', choiceId, choice],
      ['Effect', effectId, effect],
      ['Item', itemId, item],
    ];
    for (const [entity, id, handler] of deletionCases) {
      const current = await handler.findByIdOrThrow(id);
      await handler.delete(remove(entity, id, current.version), current, { userId, storyId });
      expect(await handler.findByIdOrThrow(id)).toMatchObject({ isDeleted: true });
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
    const current = await scenes.findByIdOrThrow(firstSceneId);

    const stale = scenes.update(
      {
        type: 'update',
        entity: 'Scene',
        id: firstSceneId,
        changes: { name: 'Nome que não deveria gravar', version: 99 },
      } as UpdateStoryUpdate,
      current,
      { userId, storyId },
    );

    await expect(stale).rejects.toMatchObject({ reason: 'version_conflict' });
    expect((await scenes.findByIdOrThrow(firstSceneId)).name).toBe('Chegada');
  });

  it('a Choice reports a version conflict instead of silently dropping a concurrent edit', async () => {
    const choice = new ChoiceSyncHandler();
    const choiceId = newId();
    await choice.create(
      create('Choice', choiceId, {
        sceneId: firstSceneId,
        nextSceneId: secondSceneId,
        text: 'Abrir o portão',
        notes: null,
      }),
      { userId, storyId },
    );
    const current = await choice.findByIdOrThrow(choiceId);

    const stale = choice.update(
      {
        type: 'update',
        entity: 'Choice',
        id: choiceId,
        changes: { text: 'Texto que não deveria gravar', version: 99 },
      } as UpdateStoryUpdate,
      current,
      { userId, storyId },
    );

    await expect(stale).rejects.toMatchObject({ reason: 'version_conflict' });
    expect((await choice.findByIdOrThrow(choiceId)).text).toBe('Abrir o portão');
  });

  it('refuses dependent writes when a check, group or effect would reference another story row that is absent', async () => {
    const groups = new ChoiceCheckGroupSyncHandler();
    const checks = new ChoiceCheckSyncHandler();
    const effects = new EffectSyncHandler();
    const choice = new ChoiceSyncHandler();
    const groupId = newId();
    const choiceId = newId();
    const item = new ItemSyncHandler();
    const itemId = newId();

    await expect(
      groups.create(
        create('ChoiceCheckGroup', groupId, {
          choiceId: 'missing-choice',
          combinator: 'AND',
          order: 0,
        }),
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      checks.create(
        create('ChoiceCheck', newId(), {
          groupId: 'missing-group',
          mode: 'enable',
          type: 'trigger',
          order: 0,
          sceneId: null,
          minVisits: null,
          itemId: null,
          itemPresence: null,
          triggerName: 'gate-open',
          triggerState: 'set',
        }),
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      effects.create(
        create('Effect', newId(), {
          entityType: 'Scene',
          entityId: firstSceneId,
          effectType: 'itemGrant',
          itemId: 'missing-item',
          triggerName: null,
        }),
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });

    await choice.create(
      create('Choice', choiceId, {
        sceneId: firstSceneId,
        nextSceneId: secondSceneId,
        text: 'Continue',
        notes: null,
      }),
      { userId, storyId },
    );
    await groups.create(
      create('ChoiceCheckGroup', groupId, { choiceId, combinator: 'AND', order: 0 }),
      { userId, storyId },
    );
    await item.create(
      create('Item', itemId, {
        characterOwnerId: null,
        name: 'Chave',
        category: null,
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
      { userId, storyId },
    );
    const checkId = newId();
    await checks.create(
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
      { userId, storyId },
    );
    const effectId = newId();
    await effects.create(
      create('Effect', effectId, {
        entityType: 'Scene',
        entityId: firstSceneId,
        effectType: 'itemGrant',
        itemId,
        triggerName: null,
      }),
      { userId, storyId },
    );

    await expect(
      checks.update(
        {
          type: 'update',
          entity: 'ChoiceCheck',
          id: checkId,
          changes: { itemId: 'missing-item', version: 1 },
        } as UpdateStoryUpdate,
        await checks.findByIdOrThrow(checkId),
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      effects.update(
        {
          type: 'update',
          entity: 'Effect',
          id: effectId,
          changes: { itemId: 'missing-item', version: 1 },
        } as UpdateStoryUpdate,
        await effects.findByIdOrThrow(effectId),
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it('revalidates a group and scene when an existing check is retargeted', async () => {
    const choice = new ChoiceSyncHandler();
    const groups = new ChoiceCheckGroupSyncHandler();
    const checks = new ChoiceCheckSyncHandler();
    const choiceId = newId();
    const groupId = newId();
    const checkId = newId();
    await choice.create(
      create('Choice', choiceId, {
        sceneId: firstSceneId,
        nextSceneId: secondSceneId,
        text: 'Continuar',
        notes: null,
      }),
      { userId, storyId },
    );
    await groups.create(
      create('ChoiceCheckGroup', groupId, { choiceId, combinator: 'AND', order: 0 }),
      { userId, storyId },
    );
    await checks.create(
      create('ChoiceCheck', checkId, {
        groupId,
        mode: 'enable',
        type: 'sceneCount',
        order: 0,
        sceneId: firstSceneId,
        minVisits: 1,
        itemId: null,
        itemPresence: null,
        triggerName: null,
        triggerState: null,
      }),
      { userId, storyId },
    );
    const groupCurrent = await groups.findByIdOrThrow(groupId);
    await expect(
      groups.update(
        {
          type: 'update',
          entity: 'ChoiceCheckGroup',
          id: groupId,
          changes: { choiceId: 'missing-choice', version: groupCurrent.version },
        } as UpdateStoryUpdate,
        groupCurrent,
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });

    const checkCurrent = await checks.findByIdOrThrow(checkId);
    await expect(
      checks.update(
        {
          type: 'update',
          entity: 'ChoiceCheck',
          id: checkId,
          changes: { sceneId: 'missing-scene', version: checkCurrent.version },
        } as UpdateStoryUpdate,
        checkCurrent,
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    expect(await checks.findByIdOrThrow(checkId)).toMatchObject({
      sceneId: firstSceneId,
      version: 1,
    });
  });
});
