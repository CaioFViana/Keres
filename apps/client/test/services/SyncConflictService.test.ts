/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import {
  createSyncConflictService,
  findContestedFields,
  mergeLocalOperationPayloads,
  type RecordConflictInput,
} from '../../src/services/SyncConflictService';
import { applyReorderToLocalDb } from '../../src/services/sync/applyReorderToLocalDb';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const ENTITY_ID = 'char-1';
const NOW = new Date('2026-08-10T12:00:00.000Z');

let database: TestDatabase;
let service: ReturnType<typeof createSyncConflictService>;

const baseConflict = (overrides: Partial<RecordConflictInput> = {}): RecordConflictInput => ({
  storyId: STORY_ID,
  entityType: 'Character',
  entityId: ENTITY_ID,
  reason: 'version_conflict',
  localOperationType: 'update',
  localOperationIds: [],
  localValues: { name: 'Meu nome' },
  serverValues: { name: 'Nome do servidor' },
  clientVersion: 1,
  serverVersion: 3,
  ...overrides,
});

async function seedStory() {
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'A Queda',
    type: 'linear',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
  });
}

async function seedCharacter(overrides: Partial<typeof schema.characters.$inferInsert> = {}) {
  await database.db.insert(schema.characters).values({
    id: ENTITY_ID,
    storyId: STORY_ID,
    name: 'Original',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
    ...overrides,
  });
}

async function seedOperation(
  id: string,
  overrides: Partial<typeof schema.operationLogs.$inferInsert> = {},
) {
  await database.db.insert(schema.operationLogs).values({
    id,
    storyId: STORY_ID,
    userId: 'local-user',
    operationVersion: 1,
    operationType: 'update',
    entityType: 'Character',
    entityId: ENTITY_ID,
    payload: JSON.stringify({ name: 'Meu nome' }),
    createdAt: NOW,
    isSynced: false,
    ...overrides,
  });
  return id;
}

const readCharacter = () =>
  database.db.query.characters.findFirst({ where: eq(schema.characters.id, ENTITY_ID) });
const readOperation = (id: string) =>
  database.db.query.operationLogs.findFirst({ where: eq(schema.operationLogs.id, id) });
const pushableOperations = async () =>
  (await database.db.query.operationLogs.findMany()).filter(
    (op) => op.conflictState === null && !op.isSynced,
  );

beforeEach(async () => {
  database = await createTestDatabase();
  service = createSyncConflictService(database.db);
  await seedStory();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

/**
 * This table is the reason the client no longer loses work done offline. While the conflict is pending,
 * the local operations stay out of the push - neither resent in a loop nor silently discarded. Both
 * resolutions always have to end by unblocking those operations; a conflict that closes leaving a
 * `conflicted` operation behind traps the user's edit forever.
 */
describe('recordConflict', () => {
  it('stores the conflict as pending, with both sides for the comparison screen', async () => {
    await service.recordConflict(baseConflict());

    const [pending] = await service.getPendingConflicts();
    expect(pending).toMatchObject({
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: ENTITY_ID,
      reason: 'version_conflict',
      localValues: { name: 'Meu nome' },
      serverValues: { name: 'Nome do servidor' },
      clientVersion: 1,
      serverVersion: 3,
    });
  });

  it('keeps the offending operations out of the next push', async () => {
    const operationId = await seedOperation('op-1');

    await service.recordConflict(baseConflict({ localOperationIds: [operationId] }));

    expect((await readOperation(operationId))!.conflictState).toBe('conflicted');
    expect(await pushableOperations()).toEqual([]);
  });

  /** A conflict is per entity: five offline edits of the same scene are a single decision. */
  it('folds a second conflict for the same entity into the existing one', async () => {
    await seedOperation('op-1');
    await seedOperation('op-2', { operationVersion: 2 });
    await service.recordConflict(baseConflict({ localOperationIds: ['op-1'] }));

    await service.recordConflict(baseConflict({ localOperationIds: ['op-2'], serverVersion: 9 }));

    const pending = await service.getPendingConflicts();
    expect(pending).toHaveLength(1);
    expect(pending[0].localOperationIds.sort()).toEqual(['op-1', 'op-2']);
    expect(pending[0].serverVersion).toBe(9);
  });

  it('merges the local values of the folded conflicts', async () => {
    await service.recordConflict(baseConflict({ localValues: { name: 'Primeiro' } }));

    await service.recordConflict(baseConflict({ localValues: { title: 'Segundo' } }));

    expect((await service.getPendingConflicts())[0].localValues).toEqual({
      name: 'Primeiro',
      title: 'Segundo',
    });
  });

  it('keeps conflicts of different entities apart', async () => {
    await service.recordConflict(baseConflict());
    await service.recordConflict(baseConflict({ entityId: 'char-2' }));

    expect(await service.getPendingConflicts()).toHaveLength(2);
  });

  it('records a conflict with no server side at all', async () => {
    await service.recordConflict(baseConflict({ reason: 'not_found', serverValues: null }));

    expect((await service.getPendingConflicts())[0].serverValues).toBeNull();
  });

  it('notifies the review UI both when a conflict is recorded and when it is resolved', async () => {
    await seedCharacter();
    const emitted = jest.spyOn(entityEventEmitter, 'emit');

    await service.recordConflict(baseConflict());
    const [pending] = await service.getPendingConflicts();
    await service.resolveKeepServer(pending.id);

    expect(emitted).toHaveBeenCalledWith('sync_conflicts_changed', STORY_ID);
    expect(emitted).toHaveBeenCalledWith('operation_log_updated', STORY_ID);
  });
});

describe('listing', () => {
  it('narrows to one story when asked', async () => {
    await service.recordConflict(baseConflict());
    await service.recordConflict(baseConflict({ storyId: 'outra-historia', entityId: 'char-9' }));

    expect(await service.getPendingConflicts(STORY_ID)).toHaveLength(1);
    expect(await service.countPendingConflicts(STORY_ID)).toBe(1);
  });

  it('counts everything when no story is given', async () => {
    await service.recordConflict(baseConflict());
    await service.recordConflict(baseConflict({ entityId: 'char-2' }));

    expect(await service.countPendingConflicts()).toBe(2);
  });

  it('stops listing a conflict once it is resolved', async () => {
    await seedCharacter();
    await service.recordConflict(baseConflict());
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    expect(await service.getPendingConflicts()).toEqual([]);
  });
});

describe('resolveKeepLocal', () => {
  it('writes the local values over the entity, rebased on the server version', async () => {
    await seedCharacter();
    await service.recordConflict(
      baseConflict({ localValues: { name: 'Meu nome' }, serverVersion: 3 }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    expect(await readCharacter()).toMatchObject({ name: 'Meu nome', version: 4 });
  });

  /**
   * Regression: if the value the user wants to keep is already exactly what the server holds (both sides
   * renaming to the same text, say, or a late operation resending something already applied), resending
   * it anyway only creates a new log entry with no actually new information. And with no operation
   * queued, the row must align to the server's version rather than advancing past it: bumping to
   * base + 1 with nothing to push would base the *next* edit one ahead of the server, conflicting
   * spuriously.
   */
  it('does not queue an operation when the kept value already matches the server', async () => {
    await seedCharacter({ name: 'Original' });
    await service.recordConflict(
      baseConflict({
        localValues: { name: 'Mesmo Nome' },
        serverValues: { name: 'Mesmo Nome' },
        serverVersion: 3,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    expect(await pushableOperations()).toEqual([]);
    expect(await readCharacter()).toMatchObject({ name: 'Mesmo Nome', version: 3 });
  });

  it('only resends the fields that genuinely differ from the server, not the whole value set', async () => {
    await seedCharacter({ name: 'Original' });
    await service.recordConflict(
      baseConflict({
        localValues: { name: 'Mesmo Nome', title: 'Meu Título Novo' },
        serverValues: { name: 'Mesmo Nome', title: 'Título Velho' },
        serverVersion: 3,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    const [queued] = await pushableOperations();
    expect(JSON.parse(queued.payload)).toMatchObject({ title: 'Meu Título Novo' });
    expect(JSON.parse(queued.payload)).not.toHaveProperty('name');
  });

  /**
   * Rebasing is what makes "keep mine" work: the edit is resent resting on the version the server holds
   * now, so it passes the concurrency check instead of conflicting again.
   */
  it('queues a fresh operation based on the current server version', async () => {
    await seedCharacter();
    await service.recordConflict(baseConflict({ serverVersion: 3 }));
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    const [queued] = await pushableOperations();
    expect(queued.operationType).toBe('update');
    expect(JSON.parse(queued.payload).version).toBe(4);
  });

  it('releases the old operations instead of leaving them blocked forever', async () => {
    await seedCharacter();
    const operationId = await seedOperation('op-1');
    // The seeded op bypassed the counter; align the cursor as production would have it so the
    // rebased replacement takes version 2 instead of re-issuing 1.
    await database.db
      .update(schema.stories)
      .set({ lastOperationLog: 1 })
      .where(eq(schema.stories.id, STORY_ID));
    await service.recordConflict(baseConflict({ localOperationIds: [operationId] }));
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    const old = await readOperation(operationId);
    expect(old).toMatchObject({ conflictState: 'abandoned', isSynced: true });
  });

  it('honours the values the user picked field by field', async () => {
    await seedCharacter();
    await service.recordConflict(baseConflict({ localValues: { name: 'Meu nome' } }));
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id, { name: 'Mesclado' });

    expect((await readCharacter())!.name).toBe('Mesclado');
  });

  it('records a merge as such, so the history says what happened', async () => {
    await seedCharacter();
    await service.recordConflict(baseConflict());
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id, { name: 'Mesclado' });

    const row = await database.db.query.syncConflicts.findFirst({
      where: eq(schema.syncConflicts.id, pending.id),
    });
    expect(row).toMatchObject({ status: 'resolved', resolution: 'merge' });
  });

  /**
   * An entity the server never had has to go back as a `create`. Resending an `update` would bring back
   * the same `not_found` on every cycle - the loop that kept a GalleryRelation stuck forever when its
   * owner did not exist on the server yet.
   */
  it('resends as a create when the server never had the entity', async () => {
    await seedCharacter();
    await service.recordConflict(
      baseConflict({ reason: 'not_found', serverValues: null, serverVersion: null }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    const [queued] = await pushableOperations();
    expect(queued.operationType).toBe('create');
  });

  it('restores an entity that had been deleted on the server', async () => {
    await seedCharacter({ isDeleted: false });
    await service.recordConflict(baseConflict({ reason: 'deleted_on_server' }));
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    expect(await readCharacter()).toMatchObject({ isDeleted: false, deletedAt: null });
    expect(JSON.parse((await pushableOperations())[0].payload).isDeleted).toBe(false);
    const resolved = await database.db.query.syncConflicts.findFirst();
    expect(resolved).toMatchObject({ status: 'resolved', resolution: 'restore' });
  });

  it('keeps a local deletion as a deletion', async () => {
    await seedCharacter();
    await service.recordConflict(
      baseConflict({ localOperationType: 'delete', localValues: { isDeleted: true } }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    expect((await readCharacter())!.isDeleted).toBe(true);
    expect((await pushableOperations())[0].operationType).toBe('delete');
  });

  it('does nothing for a conflict that is not there', async () => {
    await expect(service.resolveKeepLocal('nao-existe')).resolves.toBeUndefined();
  });
});

describe('resolveKeepServer', () => {
  it('overwrites the entity with what the server has', async () => {
    await seedCharacter({ name: 'Meu nome' });
    await service.recordConflict(
      baseConflict({ serverValues: { name: 'Nome do servidor' }, serverVersion: 3 }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    expect(await readCharacter()).toMatchObject({ name: 'Nome do servidor', version: 3 });
  });

  it('queues nothing, since the server already has this state', async () => {
    await seedCharacter();
    await service.recordConflict(baseConflict());
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    expect(await pushableOperations()).toEqual([]);
  });

  it('releases the local operations, marking them as given up on', async () => {
    await seedCharacter();
    const operationId = await seedOperation('op-1');
    await service.recordConflict(baseConflict({ localOperationIds: [operationId] }));
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    expect(await readOperation(operationId)).toMatchObject({
      conflictState: 'abandoned',
      isSynced: true,
    });
  });

  /** Accepting that the server does not have the entity means removing it here - without recording an */
  it('deletes the entity locally when the server does not have it', async () => {
    await seedCharacter();
    await service.recordConflict(
      baseConflict({ reason: 'not_found', serverValues: null, serverVersion: 2 }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    const character = await readCharacter();
    expect(character!.isDeleted).toBe(true);
    expect(character!.version).toBe(3);
    expect(await pushableOperations()).toEqual([]);
  });

  it('records accepting a server deletion as discarding the local edit', async () => {
    await seedCharacter({ name: 'My offline edit' });
    const operationId = await seedOperation('op-1');
    await service.recordConflict(
      baseConflict({
        reason: 'deleted_on_server',
        localOperationIds: [operationId],
        serverValues: { isDeleted: true, version: 3 },
        serverVersion: 3,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    expect(await readCharacter()).toMatchObject({ isDeleted: true, version: 3 });
    expect(await readOperation(operationId)).toMatchObject({
      conflictState: 'abandoned',
      isSynced: true,
    });
    expect(await pushableOperations()).toEqual([]);
    const resolved = await database.db.query.syncConflicts.findFirst();
    expect(resolved).toMatchObject({ status: 'resolved', resolution: 'discard' });
    expect(await service.getPendingConflicts()).toEqual([]);
  });

  it('does nothing for a conflict that is not there', async () => {
    await expect(service.resolveKeepServer('nao-existe')).resolves.toBeUndefined();
  });

  it('rewrites which characters are related for a CharacterRelation conflict', async () => {
    await database.db.insert(schema.characters).values([
      {
        id: 'char-a',
        storyId: STORY_ID,
        name: 'Ana',
        createdAt: NOW,
        updatedAt: NOW,
        version: 1,
        isDeleted: false,
      },
      {
        id: 'char-b',
        storyId: STORY_ID,
        name: 'Bia',
        createdAt: NOW,
        updatedAt: NOW,
        version: 1,
        isDeleted: false,
      },
      {
        id: 'char-c',
        storyId: STORY_ID,
        name: 'Carla',
        createdAt: NOW,
        updatedAt: NOW,
        version: 1,
        isDeleted: false,
      },
    ]);
    await database.db.insert(schema.characterRelations).values({
      id: 'relation-1',
      storyId: STORY_ID,
      character1Id: 'char-a',
      character2Id: 'char-b',
      relationType: 'allies',
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      isDeleted: false,
    });

    await service.recordConflict(
      baseConflict({
        entityType: 'CharacterRelation',
        entityId: 'relation-1',
        localValues: { character1Id: 'char-a', character2Id: 'char-b', relationType: 'allies' },
        serverValues: { character1Id: 'char-a', character2Id: 'char-c', relationType: 'rivals' },
        serverVersion: 3,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    const relation = await database.db.query.characterRelations.findFirst({
      where: eq(schema.characterRelations.id, 'relation-1'),
    });
    expect(relation).toMatchObject({
      character1Id: 'char-a',
      character2Id: 'char-c',
      relationType: 'rivals',
    });
  });
});

/**
 * A reorder has no entity row for "the order" - the disputed value is `reorderItems`, which touches N
 * rows of another table (a Chapter's Scenes). That is why both resolutions bypass the generic
 * `recordRebasedOperation` path (keep-server still aligns the container row via `writeEntity`).
 */
describe('reorder conflicts', () => {
  const CHAPTER_ID = 'chapter-1';

  async function seedChapterWithScenes() {
    // Version 2 everywhere: the local reorder authoring already bumped these rows once when it
    // logged the still-pending operation - the conflict is between that pending op (base 1)
    // and the server's own reorder (now at version 2).
    await database.db.insert(schema.chapters).values({
      id: CHAPTER_ID,
      storyId: STORY_ID,
      name: 'Capítulo 1',
      index: 1,
      createdAt: NOW,
      updatedAt: NOW,
      version: 2,
      isDeleted: false,
    });
    await database.db.insert(schema.scenes).values([
      {
        id: 'scene-a',
        storyId: STORY_ID,
        chapterId: CHAPTER_ID,
        locationId: 'location-1',
        name: 'A',
        index: 2,
        createdAt: NOW,
        updatedAt: NOW,
        version: 2,
        isDeleted: false,
      },
      {
        id: 'scene-b',
        storyId: STORY_ID,
        chapterId: CHAPTER_ID,
        locationId: 'location-1',
        name: 'B',
        index: 1,
        createdAt: NOW,
        updatedAt: NOW,
        version: 2,
        isDeleted: false,
      },
    ]);
  }

  async function seedReorderConflict() {
    const opId = await seedOperation('op-reorder', {
      operationType: 'reorder',
      entityType: 'Chapter',
      entityId: CHAPTER_ID,
      payload: JSON.stringify({
        reorderItems: [
          { id: 'scene-a', newIndex: 1 },
          { id: 'scene-b', newIndex: 2 },
        ],
        version: 1,
      }),
    });
    await service.recordConflict({
      storyId: STORY_ID,
      entityType: 'Chapter',
      entityId: CHAPTER_ID,
      reason: 'concurrent_edit',
      localOperationType: 'reorder',
      localOperationIds: [opId],
      localValues: {
        reorderItems: [
          { id: 'scene-a', newIndex: 1 },
          { id: 'scene-b', newIndex: 2 },
        ],
      },
      serverValues: {
        reorderItems: [
          { id: 'scene-b', newIndex: 1 },
          { id: 'scene-a', newIndex: 2 },
        ],
      },
      clientVersion: 1,
      serverVersion: 2,
    });
    return opId;
  }

  it('keeps the same pending operation, just rebased, instead of abandoning and recreating it', async () => {
    await seedChapterWithScenes();
    const opId = await seedReorderConflict();

    const [pending] = await service.getPendingConflicts();
    await service.resolveKeepLocal(pending.id);

    const op = await readOperation(opId);
    expect(op).toBeDefined();
    expect(op!.conflictState).toBeNull();
    expect(op!.isSynced).toBe(false);
    expect(JSON.parse(op!.payload).version).toBe(3); // serverVersion (2) + 1

    // The local order was untouched - "keep mine" for a reorder moves no indices, it only
    // releases the pending operation to be resent. But the rows anticipate the push: the server
    // will bump everything once per released op, so they rest at serverVersion + chain (2 + 1).
    const sceneA = await database.db.query.scenes.findFirst({
      where: eq(schema.scenes.id, 'scene-a'),
    });
    expect(sceneA!.index).toBe(2);
    const scenes = await database.db.query.scenes.findMany();
    expect(scenes.map(({ version }) => version).sort()).toEqual([3, 3]);
    const chapter = await database.db.query.chapters.findFirst({
      where: eq(schema.chapters.id, CHAPTER_ID),
    });
    expect(chapter!.version).toBe(3);
  });

  it('chains several pending reorders onto the server version and anticipates every row', async () => {
    await seedChapterWithScenes();
    const first = await seedOperation('op-reorder-1', {
      operationType: 'reorder',
      operationVersion: 1,
      entityType: 'Chapter',
      entityId: CHAPTER_ID,
      payload: JSON.stringify({
        reorderItems: [
          { id: 'scene-a', newIndex: 1 },
          { id: 'scene-b', newIndex: 2 },
        ],
        version: 2,
      }),
    });
    const second = await seedOperation('op-reorder-2', {
      operationType: 'reorder',
      operationVersion: 2,
      entityType: 'Chapter',
      entityId: CHAPTER_ID,
      payload: JSON.stringify({
        reorderItems: [
          { id: 'scene-b', newIndex: 1 },
          { id: 'scene-a', newIndex: 2 },
        ],
        version: 3,
      }),
    });
    await service.recordConflict({
      storyId: STORY_ID,
      entityType: 'Chapter',
      entityId: CHAPTER_ID,
      reason: 'concurrent_edit',
      localOperationType: 'reorder',
      localOperationIds: [first, second],
      localValues: { reorderItems: [] },
      serverValues: {
        reorderItems: [
          { id: 'scene-a', newIndex: 1 },
          { id: 'scene-b', newIndex: 2 },
        ],
      },
      clientVersion: 2,
      serverVersion: 5,
    });

    const [pending] = await service.getPendingConflicts();
    await service.resolveKeepLocal(pending.id);

    // Chained bases: the first rests on 5, the second on 6. Giving both the same base would
    // make the second conflict again on push.
    expect(JSON.parse((await readOperation(first))!.payload).version).toBe(6);
    expect(JSON.parse((await readOperation(second))!.payload).version).toBe(7);
    expect(await pushableOperations()).toHaveLength(2);
    const scenes = await database.db.query.scenes.findMany();
    expect(scenes.map(({ version }) => version).sort()).toEqual([7, 7]);
    const chapter = await database.db.query.chapters.findFirst({
      where: eq(schema.chapters.id, CHAPTER_ID),
    });
    expect(chapter!.version).toBe(7);
  });

  it('shows no field-by-field picker for a reorder conflict, since reorderItems is not a scalar field', async () => {
    await seedChapterWithScenes();
    await seedReorderConflict();

    const [pending] = await service.getPendingConflicts();

    expect(pending.contestedFields).toEqual([]);
  });

  it('closes a reorder conflict safely even when its obsolete operation and server order are both absent', async () => {
    await service.recordConflict({
      storyId: STORY_ID,
      entityType: 'Chapter',
      entityId: CHAPTER_ID,
      reason: 'concurrent_edit',
      localOperationType: 'reorder',
      localOperationIds: ['operation-already-purged'],
      localValues: { reorderItems: [] },
      serverValues: { reorderItems: [] },
      clientVersion: 1,
      serverVersion: 2,
    });
    const [pending] = await service.getPendingConflicts();

    await expect(service.resolveKeepLocal(pending.id)).resolves.toBeUndefined();
    await service.recordConflict({
      storyId: STORY_ID,
      entityType: 'Chapter',
      entityId: CHAPTER_ID,
      reason: 'concurrent_edit',
      localOperationType: 'reorder',
      localOperationIds: [],
      localValues: { reorderItems: [] },
      serverValues: { reorderItems: [] },
      clientVersion: 1,
      serverVersion: 2,
    });
    const [second] = await service.getPendingConflicts();
    await expect(service.resolveKeepServer(second.id)).resolves.toBeUndefined();
    expect(await service.getPendingConflicts()).toEqual([]);
  });

  it('applies the server order to the local Scenes and abandons the pending local reorder', async () => {
    await seedChapterWithScenes();
    const opId = await seedReorderConflict();

    const [pending] = await service.getPendingConflicts();
    await service.resolveKeepServer(pending.id);

    const op = await readOperation(opId);
    expect(op!.conflictState).toBe('abandoned');
    expect(op!.isSynced).toBe(true);

    const sceneA = await database.db.query.scenes.findFirst({
      where: eq(schema.scenes.id, 'scene-a'),
    });
    const sceneB = await database.db.query.scenes.findFirst({
      where: eq(schema.scenes.id, 'scene-b'),
    });
    expect(sceneA!.index).toBe(2);
    expect(sceneB!.index).toBe(1);
    // The apply moved indices but bumped nothing: the abandoned local op already counted its
    // bump, so bumping again would run the rows ahead of the server. The chapter is aligned
    // exactly to the version the server holds.
    expect(sceneA!.version).toBe(2);
    expect(sceneB!.version).toBe(2);
    const chapter = await database.db.query.chapters.findFirst({
      where: eq(schema.chapters.id, CHAPTER_ID),
    });
    expect(chapter!.version).toBe(2);
    expect(await service.getPendingConflicts()).toEqual([]);
  });
});

/**
 * Reordering the story's own collections.
 *
 * `applyReorderToLocalDb` fans out to three different tables from one operation shape, and which one
 * it writes to is decided by `entity` plus `reorderTarget`. Scene reorders are covered above; these
 * are the two branches nothing exercised, and they are the ones the Events feature edits - it adds a
 * fourth target sharing this code (see `docs/events_feature_plan.md` section 4).
 */
describe('story-level reorder conflicts', () => {
  // Version 2 everywhere: the local reorder authoring already bumped these rows once when it
  // logged the still-pending operation.
  const seedChapters = async () =>
    database.db.insert(schema.chapters).values([
      {
        id: 'chapter-a',
        storyId: STORY_ID,
        name: 'A',
        // Seeded in the *local* order, which is the reverse of what the server sends below: a test
        // seeded in the server's order would pass without a single row being written.
        index: 2,
        createdAt: NOW,
        updatedAt: NOW,
        version: 2,
        isDeleted: false,
      },
      {
        id: 'chapter-b',
        storyId: STORY_ID,
        name: 'B',
        index: 1,
        createdAt: NOW,
        updatedAt: NOW,
        version: 2,
        isDeleted: false,
      },
    ]);

  const field = (id: string, name: string, order: number) => ({
    id,
    storyId: STORY_ID,
    entityType: 'Character' as const,
    name,
    key: name.toLowerCase(),
    description: null,
    type: AttributeType.TEXT,
    targetEntityType: null,
    isRequired: false,
    defaultValue: null,
    order,
    createdAt: NOW,
    updatedAt: NOW,
    version: 2,
    isDeleted: false,
  });

  const seedFields = async () =>
    database.db
      .insert(schema.storySchemaFields)
      .values([field('field-a', 'A', 1), field('field-b', 'B', 0)]);

  const seedStats = async () =>
    database.db.insert(schema.stats).values([
      {
        id: 'stat-a',
        storyId: STORY_ID,
        name: 'Courage',
        isPrimary: true,
        order: 1,
        createdAt: NOW,
        updatedAt: NOW,
        version: 2,
        isDeleted: false,
      },
      {
        id: 'stat-b',
        storyId: STORY_ID,
        name: 'Wisdom',
        isPrimary: true,
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
        version: 2,
        isDeleted: false,
      },
    ]);

  const seedStoryReorderConflict = async (
    serverItems: { id: string; newIndex: number }[],
    payloadExtras: Record<string, unknown> = {},
  ) => {
    const total = serverItems.length;
    // The local order is the server's, inverted - so every row has to move for the resolution to
    // be doing anything.
    const localItems = serverItems.map((item) => ({
      id: item.id,
      newIndex: total + 1 - item.newIndex,
    }));
    const opId = await seedOperation('op-story-reorder', {
      operationType: 'reorder',
      entityType: 'Story',
      entityId: STORY_ID,
      payload: JSON.stringify({ reorderItems: localItems, version: 1, ...payloadExtras }),
    });
    await service.recordConflict({
      storyId: STORY_ID,
      entityType: 'Story',
      entityId: STORY_ID,
      reason: 'concurrent_edit',
      localOperationType: 'reorder',
      localOperationIds: [opId],
      localValues: { reorderItems: localItems, ...payloadExtras },
      serverValues: { reorderItems: serverItems, ...payloadExtras },
      clientVersion: 1,
      serverVersion: 2,
    });
    return opId;
  };

  const chapterIndexes = async () => {
    const rows = await database.db.query.chapters.findMany();
    return Object.fromEntries(rows.map((row) => [row.id, row.index]));
  };

  it('applies the server chapter order and abandons the local one', async () => {
    await seedChapters();
    const opId = await seedStoryReorderConflict([
      { id: 'chapter-a', newIndex: 1 },
      { id: 'chapter-b', newIndex: 2 },
    ]);

    const [pending] = await service.getPendingConflicts();
    await service.resolveKeepServer(pending.id);

    // Both rows moved: they were seeded at a:2 / b:1.
    expect(await chapterIndexes()).toEqual({ 'chapter-a': 1, 'chapter-b': 2 });
    expect((await readOperation(opId))!.conflictState).toBe('abandoned');
    // The apply moved indices but bumped nothing (the abandoned op's bump already counted);
    // the story is aligned exactly to the version the server holds.
    const chapterVersions = await database.db.query.chapters.findMany();
    expect(chapterVersions.map(({ version }) => version).sort()).toEqual([2, 2]);
    const story = await database.db.query.stories.findFirst({
      where: eq(schema.stories.id, STORY_ID),
    });
    expect(story!.version).toBe(2);
  });

  /** Keeping mine writes nothing locally: the pending reorder is simply rebased and resent. */
  it('leaves the chapter order alone when the local one is kept', async () => {
    await seedChapters();
    const opId = await seedStoryReorderConflict([
      { id: 'chapter-a', newIndex: 1 },
      { id: 'chapter-b', newIndex: 2 },
    ]);

    const [pending] = await service.getPendingConflicts();
    await service.resolveKeepLocal(pending.id);

    expect(await chapterIndexes()).toEqual({ 'chapter-a': 2, 'chapter-b': 1 });
    const op = await readOperation(opId);
    expect(op!.conflictState).toBeNull();
    expect(JSON.parse(op!.payload).version).toBe(3);
    // ...but the rows anticipate the push at serverVersion + chain (2 + 1).
    const chapterVersions = await database.db.query.chapters.findMany();
    expect(chapterVersions.map(({ version }) => version).sort()).toEqual([3, 3]);
    const story = await database.db.query.stories.findFirst({
      where: eq(schema.stories.id, STORY_ID),
    });
    expect(story!.version).toBe(3);
  });

  /**
   * Attribute order is stored **zero-based** while a reorder item is one-based, so this branch
   * subtracts one. Getting it wrong shifts every custom attribute on every form by one position, and
   * nothing else in the system would notice.
   */
  it('writes attribute order zero-based, one below the reorder index', async () => {
    await seedFields();
    await seedStoryReorderConflict(
      [
        { id: 'field-a', newIndex: 1 },
        { id: 'field-b', newIndex: 2 },
      ],
      { reorderTarget: 'StorySchemaField', schemaEntityType: 'Character' },
    );

    const [pending] = await service.getPendingConflicts();
    await service.resolveKeepServer(pending.id);

    const rows = await database.db.query.storySchemaFields.findMany();
    expect(Object.fromEntries(rows.map((row) => [row.id, row.order]))).toEqual({
      'field-a': 0,
      'field-b': 1,
    });
    expect(rows.map(({ version }) => version).sort()).toEqual([2, 2]);
    const story = await database.db.query.stories.findFirst({
      where: eq(schema.stories.id, STORY_ID),
    });
    expect(story!.version).toBe(2);
  });

  /** The reorder target decides the table; a schema-field reorder must not touch the chapters. */
  it('does not touch the chapters when the target is the schema fields', async () => {
    await seedChapters();
    await seedFields();
    await seedStoryReorderConflict(
      [
        { id: 'field-a', newIndex: 2 },
        { id: 'field-b', newIndex: 1 },
      ],
      { reorderTarget: 'StorySchemaField', schemaEntityType: 'Character' },
    );

    const [pending] = await service.getPendingConflicts();
    await service.resolveKeepServer(pending.id);

    expect(await chapterIndexes()).toEqual({ 'chapter-a': 2, 'chapter-b': 1 });
  });

  it('writes stat order zero-based without touching the chapters', async () => {
    await seedChapters();
    await seedStats();
    await seedStoryReorderConflict(
      [
        { id: 'stat-a', newIndex: 1 },
        { id: 'stat-b', newIndex: 2 },
      ],
      { reorderTarget: 'Stat' },
    );

    const [pending] = await service.getPendingConflicts();
    await service.resolveKeepServer(pending.id);

    const rows = await database.db.query.stats.findMany();
    expect(Object.fromEntries(rows.map((row) => [row.id, row.order]))).toEqual({
      'stat-a': 0,
      'stat-b': 1,
    });
    expect(rows.map(({ version }) => version).sort()).toEqual([2, 2]);
    expect(await chapterIndexes()).toEqual({ 'chapter-a': 2, 'chapter-b': 1 });
    const chapters = await database.db.query.chapters.findMany();
    expect(chapters.map(({ version }) => version).sort()).toEqual([2, 2]);
    const story = await database.db.query.stories.findFirst({
      where: eq(schema.stories.id, STORY_ID),
    });
    expect(story!.version).toBe(2);
  });

  it('does nothing at all when the server sent no items', async () => {
    await seedChapters();
    await seedOperation('op-empty', {
      operationType: 'reorder',
      entityType: 'Story',
      entityId: STORY_ID,
      payload: JSON.stringify({ reorderItems: [], version: 1 }),
    });
    await service.recordConflict({
      storyId: STORY_ID,
      entityType: 'Story',
      entityId: STORY_ID,
      reason: 'concurrent_edit',
      localOperationType: 'reorder',
      localOperationIds: ['op-empty'],
      localValues: { reorderItems: [] },
      serverValues: { reorderItems: [] },
      clientVersion: 1,
      serverVersion: 2,
    });

    const [pending] = await service.getPendingConflicts();
    await service.resolveKeepServer(pending.id);

    expect(await chapterIndexes()).toEqual({ 'chapter-a': 2, 'chapter-b': 1 });
  });

  it('bumps the container with the items when applying a remote reorder directly', async () => {
    await seedChapters();

    await applyReorderToLocalDb(
      database.db,
      {
        entity: 'Story',
        id: STORY_ID,
        reorderItems: [
          { id: 'chapter-a', newIndex: 1 },
          { id: 'chapter-b', newIndex: 2 },
        ],
      } as never,
      NOW,
    );

    // The server bumps the container once per applied reorder; an applier that skips this
    // would base its next container edit on a stale version.
    expect(await chapterIndexes()).toEqual({ 'chapter-a': 1, 'chapter-b': 2 });
    const chapters = await database.db.query.chapters.findMany();
    expect(chapters.map(({ version }) => version).sort()).toEqual([3, 3]);
    const story = await database.db.query.stories.findFirst({
      where: eq(schema.stories.id, STORY_ID),
    });
    expect(story!.version).toBe(2);
  });

  it('leaves every row alone, with one warning, for a reorder target it does not know', async () => {
    await seedChapters();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await applyReorderToLocalDb(
      database.db,
      {
        entity: 'Story',
        id: STORY_ID,
        reorderTarget: 'Milestone',
        reorderItems: [{ id: 'milestone-1', newIndex: 1 }],
      } as never,
      NOW,
    );

    // Foreign ids match no chapter, so the chapters branch degrades to a no-op - but the
    // container still deterministically follows the server's bump for this operation.
    expect(await chapterIndexes()).toEqual({ 'chapter-a': 2, 'chapter-b': 1 });
    const chapters = await database.db.query.chapters.findMany();
    expect(chapters.map(({ version }) => version).sort()).toEqual([2, 2]);
    const story = await database.db.query.stories.findFirst({
      where: eq(schema.stories.id, STORY_ID),
    });
    expect(story!.version).toBe(2);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("unrecognised reorder target 'Milestone'"),
    );
  });
});

/**
 * The resolution actually written to the row.
 *
 * The review sheet reads this column back, and so does anybody auditing what was decided months
 * later. `merge`, `restore` and `discard` are asserted where they are produced; these are the two
 * plain ones, which nothing named until now.
 */
describe('the recorded resolution', () => {
  it('records keeping the local value as keep_local', async () => {
    await seedCharacter();
    await service.recordConflict(baseConflict());
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    const [row] = await database.db.query.syncConflicts.findMany();
    expect(row).toMatchObject({ status: 'resolved', resolution: 'keep_local' });
  });

  it('records accepting the server value as keep_server', async () => {
    await seedCharacter();
    await service.recordConflict(baseConflict());
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    const [row] = await database.db.query.syncConflicts.findMany();
    expect(row).toMatchObject({ status: 'resolved', resolution: 'keep_server' });
  });
});

describe('dismissConflict', () => {
  it('takes the conflict off the pending list', async () => {
    await service.recordConflict(baseConflict());
    const [pending] = await service.getPendingConflicts();

    await service.dismissConflict(pending.id);

    expect(await service.getPendingConflicts()).toEqual([]);
  });

  /**
   * Without releasing the operations, dismissing would only hide the conflict from the list while the
   * edits stayed `conflicted` forever - out of every future push, with no way to resolve them.
   */
  it('releases the blocked operations instead of leaving them stranded', async () => {
    const operationId = await seedOperation('op-1');
    await service.recordConflict(baseConflict({ localOperationIds: [operationId] }));
    const [pending] = await service.getPendingConflicts();

    await service.dismissConflict(pending.id);

    expect((await readOperation(operationId))!.conflictState).toBe('abandoned');
  });

  it('is safe for a conflict that is not there', async () => {
    await expect(service.dismissConflict('nao-existe')).resolves.toBeUndefined();
  });

  it('reverts the row to the server copy so it stops showing values that will never sync', async () => {
    await seedCharacter({ name: 'Local unsynced edit', version: 2 });
    await service.recordConflict(
      baseConflict({
        localValues: { name: 'Local unsynced edit' },
        serverValues: { name: 'Nome do servidor' },
        serverVersion: 3,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.dismissConflict(pending.id);

    expect(await readCharacter()).toMatchObject({ name: 'Nome do servidor', version: 3 });
    expect(await service.getPendingConflicts()).toEqual([]);
  });

  it('leaves the row alone when there is no server copy to revert to', async () => {
    await seedCharacter({ name: 'Only local copy', version: 1 });
    await service.recordConflict(
      baseConflict({
        reason: 'not_found',
        localValues: { name: 'Only local copy' },
        serverValues: null,
        serverVersion: null,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.dismissConflict(pending.id);

    expect(await readCharacter()).toMatchObject({ name: 'Only local copy', version: 1 });
  });

  it('restores live flags when the dismissed quarantine was a delete', async () => {
    await seedCharacter({ version: 2, isDeleted: true, deletedAt: NOW });
    await seedOperation('op-del', { operationType: 'delete' });
    await service.recordConflict(
      baseConflict({
        reason: 'validation',
        localOperationType: 'delete',
        localOperationIds: ['op-del'],
        serverValues: null,
        serverVersion: null,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.dismissConflict(pending.id);

    expect(await readCharacter()).toMatchObject({
      version: 2,
      isDeleted: false,
      deletedAt: null,
    });
    expect((await readOperation('op-del'))!.conflictState).toBe('abandoned');
    expect(await service.getPendingConflicts()).toEqual([]);
  });

  it('leaves the row alone when the dismissed quarantine was not a delete', async () => {
    await seedCharacter();
    await seedOperation('op-q', { operationType: 'update' });
    await service.recordConflict(
      baseConflict({
        reason: 'validation',
        localOperationType: 'update',
        localOperationIds: ['op-q'],
        serverValues: null,
        serverVersion: null,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.dismissConflict(pending.id);

    expect(await readCharacter()).toMatchObject({
      name: 'Original',
      version: 1,
      isDeleted: false,
    });
    expect(await service.getPendingConflicts()).toEqual([]);
  });
});

describe('findContestedFields', () => {
  it('lists the fields the two sides disagree on', () => {
    expect(
      findContestedFields({ name: 'Meu', title: 'Igual' }, { name: 'Servidor', title: 'Igual' }),
    ).toEqual(['name']);
  });

  /**
   * The key has to be *present* on the server's side. On a pull, `serverValues` carries only what the
   * remote operation changed: an absent field means the server had no opinion, and comparing it with
   * `undefined` would flag as disputed what should merge silently.
   */
  it('ignores a field the server did not touch', () => {
    expect(findContestedFields({ name: 'Meu', title: 'Só meu' }, { name: 'Meu' })).toEqual([]);
  });

  it('treats every local field as contested when the server has nothing', () => {
    expect(findContestedFields({ name: 'Meu', title: 'Meu' }, null).sort()).toEqual([
      'name',
      'title',
    ]);
  });

  it('ignores the bookkeeping fields, which are not the user content', () => {
    const contested = findContestedFields(
      { name: 'Meu', version: 1, updatedAt: 'x', id: 'char-1' },
      { name: 'Servidor', version: 9, updatedAt: 'y', id: 'char-1' },
    );

    expect(contested).toEqual(['name']);
  });

  it('reports nothing when the two sides agree', () => {
    expect(findContestedFields({ name: 'Igual' }, { name: 'Igual' })).toEqual([]);
  });

  /**
   * A date survives the round trip through the operation log as a string, so the two sides of a
   * comparison are rarely the same shape. Comparing them as written would mark an untouched date as
   * disputed and put a field in front of the user that nobody edited.
   */
  it('reads a Date and its own serialization as the same instant', () => {
    const instant = new Date('2026-08-10T12:00:00.000Z');

    expect(findContestedFields({ when: instant }, { when: instant.toISOString() })).toEqual([]);
    expect(findContestedFields({ when: instant }, { when: '2026-08-11T12:00:00.000Z' })).toEqual([
      'when',
    ]);
  });

  it('treats a missing date and a present one as disputed', () => {
    const instant = new Date('2026-08-10T12:00:00.000Z');
    expect(findContestedFields({ when: instant }, { when: null })).toEqual(['when']);
  });

  /**
   * `reorderItems` is the case that matters: an array is never `===` itself across a JSON round trip,
   * so a shallow comparison would report every reorder as a disagreement about its own contents.
   */
  it('compares arrays and objects by their contents', () => {
    const items = [{ id: 'a', newIndex: 1 }];

    expect(findContestedFields({ reorderItems: items }, { reorderItems: [...items] })).toEqual([]);
    expect(
      findContestedFields({ reorderItems: items }, { reorderItems: [{ id: 'a', newIndex: 2 }] }),
    ).toEqual(['reorderItems']);
  });
});

/**
 * An entity type with no local table.
 *
 * `getEntityTable` returns nothing for a type this client does not store, which happens when a newer
 * server sends an entity this build has never heard of. Resolving must be a no-op with a log line,
 * never a crash: the conflict screen is the last place a writer should meet an exception.
 */
describe('an entity this client does not store', () => {
  it('resolves without writing anything and without throwing', async () => {
    await service.recordConflict(
      baseConflict({ entityType: 'SomethingFromTheFuture', entityId: 'x-1' }),
    );
    const [pending] = await service.getPendingConflicts();

    await expect(service.resolveKeepLocal(pending.id)).resolves.toBeUndefined();

    const [row] = await database.db.query.syncConflicts.findMany();
    expect(row).toMatchObject({ status: 'resolved', resolution: 'keep_local' });
  });
});

describe('mergeLocalOperationPayloads', () => {
  const operation = (payload: Record<string, unknown>) =>
    ({ payload: JSON.stringify(payload) }) as never;

  it('unites the payloads into one set of desired values', () => {
    const merged = mergeLocalOperationPayloads([
      operation({ name: 'A' }),
      operation({ title: 'B' }),
    ]);

    expect(merged).toEqual({ name: 'A', title: 'B' });
  });

  /** Newer operations come later and win: it is the user's latest intent. */
  it('lets the newest operation win a field', () => {
    const merged = mergeLocalOperationPayloads([
      operation({ name: 'Antigo' }),
      operation({ name: 'Novo' }),
    ]);

    expect(merged.name).toBe('Novo');
  });

  it('drops the bookkeeping fields', () => {
    const merged = mergeLocalOperationPayloads([
      operation({ name: 'A', version: 3, id: 'char-1' }),
    ]);

    expect(merged).toEqual({ name: 'A' });
  });

  it('survives an unreadable payload', () => {
    const merged = mergeLocalOperationPayloads([
      { payload: 'nao e json' } as never,
      operation({ name: 'A' }),
    ]);

    expect(merged).toEqual({ name: 'A' });
  });

  it('returns nothing for no operations', () => {
    expect(mergeLocalOperationPayloads([])).toEqual({});
  });
});

describe('resolveKeepServerAndCloneBoard', () => {
  it('creates a copy with the local drawing, then keeps the server row', async () => {
    await database.db.insert(schema.boards).values({
      id: 'board-1',
      storyId: STORY_ID,
      name: 'Royal family',
      description: null,
      content: { nodes: [], edges: [] },
      createdAt: NOW,
      updatedAt: NOW,
      version: 2,
      isDeleted: false,
    });
    const operationId = await seedOperation('op-board', {
      entityType: 'Board',
      entityId: 'board-1',
      payload: JSON.stringify({
        content: {
          nodes: [{ id: '01ABCDEF', kind: 'note', x: 1, y: 2, title: 'Mine', body: null }],
          edges: [],
        },
      }),
    });
    // The seeded op bypassed the counter; align the cursor as production would have it so the
    // clone's replacement op takes version 2 instead of re-issuing 1.
    await database.db
      .update(schema.stories)
      .set({ lastOperationLog: 1 })
      .where(eq(schema.stories.id, STORY_ID));
    await service.recordConflict(
      baseConflict({
        entityType: 'Board',
        entityId: 'board-1',
        localOperationIds: [operationId],
        localValues: {
          content: {
            nodes: [{ id: '01ABCDEF', kind: 'note', x: 1, y: 2, title: 'Mine', body: null }],
            edges: [],
          },
        },
        serverValues: { name: 'Royal family', content: { nodes: [], edges: [] }, version: 3 },
        serverVersion: 3,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServerAndCloneBoard(pending.id, 'local-user', 'Royal family (copy)');

    const rows = await database.db.query.boards.findMany({
      where: eq(schema.boards.storyId, STORY_ID),
    });
    const copy = rows.find((row) => row.id !== 'board-1');
    const original = rows.find((row) => row.id === 'board-1');
    expect(copy).toMatchObject({
      name: 'Royal family (copy)',
      content: {
        nodes: [{ id: '01ABCDEF', kind: 'note', title: 'Mine' }],
        edges: [],
      },
    });
    expect(original).toMatchObject({
      name: 'Royal family',
      content: { nodes: [], edges: [] },
      version: 3,
    });
  });

  it('refuses to clone when there is no conflict to clone from', async () => {
    await expect(
      service.resolveKeepServerAndCloneBoard('nao-existe', 'local-user', 'Copy'),
    ).rejects.toThrow('Board clone is only available for a Board content conflict.');
  });

  it('refuses to clone a conflict that is not about a Board', async () => {
    await seedCharacter();
    await service.recordConflict(baseConflict());
    const [pending] = await service.getPendingConflicts();

    await expect(
      service.resolveKeepServerAndCloneBoard(pending.id, 'local-user', 'Copy'),
    ).rejects.toThrow('Board clone is only available for a Board content conflict.');
  });

  /**
   * The local drawing usually arrives in the conflict's `localValues`, but a conflict recorded from
   * an older client (or from a delete) may not carry it. The row itself still has the drawing, and
   * the clone must take it from there rather than saving an empty board.
   */
  it('falls back to the stored drawing when the conflict carries no content', async () => {
    await database.db.insert(schema.boards).values({
      id: 'board-1',
      storyId: STORY_ID,
      name: 'Royal family',
      description: null,
      content: {
        nodes: [{ id: '01ABCDEF', kind: 'note', x: 1, y: 2, title: 'Mine', body: null }],
        edges: [],
      },
      createdAt: NOW,
      updatedAt: NOW,
      version: 2,
      isDeleted: false,
    });
    await service.recordConflict(
      baseConflict({
        entityType: 'Board',
        entityId: 'board-1',
        localValues: { name: 'Royal family' },
        serverValues: { name: 'Royal family', content: { nodes: [], edges: [] }, version: 3 },
        serverVersion: 3,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServerAndCloneBoard(pending.id, 'local-user', 'Royal family (copy)');

    const rows = await database.db.query.boards.findMany({
      where: eq(schema.boards.storyId, STORY_ID),
    });
    const copy = rows.find((row) => row.id !== 'board-1');
    expect(copy).toMatchObject({
      name: 'Royal family (copy)',
      content: { nodes: [{ id: '01ABCDEF', title: 'Mine' }], edges: [] },
    });
  });

  /**
   * Neither the conflict nor the database has a drawing: the board row itself is gone (deleted on
   * another device and the delete already applied here). Cloning must still produce a valid empty
   * board, not crash on the missing content.
   */
  it('creates no second copy when the resolution is retried after the clone committed', async () => {
    await database.db.insert(schema.boards).values({
      id: 'board-1',
      storyId: STORY_ID,
      name: 'Royal family',
      description: null,
      content: { nodes: [], edges: [] },
      createdAt: NOW,
      updatedAt: NOW,
      version: 2,
      isDeleted: false,
    });
    const operationId = await seedOperation('op-board', {
      entityType: 'Board',
      entityId: 'board-1',
      payload: JSON.stringify({
        content: {
          nodes: [{ id: '01ABCDEF', kind: 'note', x: 1, y: 2, title: 'Mine', body: null }],
          edges: [],
        },
      }),
    });
    await database.db
      .update(schema.stories)
      .set({ lastOperationLog: 1 })
      .where(eq(schema.stories.id, STORY_ID));
    await service.recordConflict(
      baseConflict({
        entityType: 'Board',
        entityId: 'board-1',
        localOperationIds: [operationId],
        localValues: {
          content: {
            nodes: [{ id: '01ABCDEF', kind: 'note', x: 1, y: 2, title: 'Mine', body: null }],
            edges: [],
          },
        },
        serverValues: { name: 'Royal family', content: { nodes: [], edges: [] }, version: 3 },
        serverVersion: 3,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    // A failure between the clone and the keepServer half (or a retried tap) re-enters with
    // the copy already saved: the second call must finish the resolution, not duplicate it.
    await service.resolveKeepServerAndCloneBoard(pending.id, 'local-user', 'Royal family (copy)');
    await service.resolveKeepServerAndCloneBoard(pending.id, 'local-user', 'Royal family (copy)');

    const rows = await database.db.query.boards.findMany({
      where: eq(schema.boards.storyId, STORY_ID),
    });
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.id !== 'board-1')).toHaveLength(1);
    expect(await service.getPendingConflicts()).toHaveLength(0);
  });

  it('still clones when the same-named board holds a different drawing', async () => {
    await database.db.insert(schema.boards).values([
      {
        id: 'board-1',
        storyId: STORY_ID,
        name: 'Royal family',
        description: null,
        content: { nodes: [], edges: [] },
        createdAt: NOW,
        updatedAt: NOW,
        version: 2,
        isDeleted: false,
      },
      {
        id: 'board-other',
        storyId: STORY_ID,
        name: 'Royal family (copy)',
        description: null,
        content: {
          nodes: [{ id: 'OTHER', kind: 'note', x: 0, y: 0, title: 'Elsewhere', body: null }],
          edges: [],
        },
        createdAt: NOW,
        updatedAt: NOW,
        version: 1,
        isDeleted: false,
      },
    ]);
    await service.recordConflict(
      baseConflict({
        entityType: 'Board',
        entityId: 'board-1',
        localValues: {
          content: {
            nodes: [{ id: '01ABCDEF', kind: 'note', x: 1, y: 2, title: 'Mine', body: null }],
            edges: [],
          },
        },
        serverValues: { name: 'Royal family', content: { nodes: [], edges: [] }, version: 3 },
        serverVersion: 3,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServerAndCloneBoard(pending.id, 'local-user', 'Royal family (copy)');

    const rows = await database.db.query.boards.findMany({
      where: eq(schema.boards.storyId, STORY_ID),
    });
    expect(rows).toHaveLength(3);
  });

  it('clones an empty board when the drawing exists nowhere', async () => {
    await service.recordConflict(
      baseConflict({
        entityType: 'Board',
        entityId: 'board-missing',
        localValues: { name: 'Royal family' },
        serverValues: { name: 'Royal family', content: { nodes: [], edges: [] }, version: 3 },
        serverVersion: 3,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServerAndCloneBoard(pending.id, 'local-user', 'Royal family (copy)');

    const rows = await database.db.query.boards.findMany({
      where: eq(schema.boards.storyId, STORY_ID),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Royal family (copy)',
      content: { nodes: [], edges: [] },
    });
  });
});

/**
 * A conflict row whose JSON columns no longer parse.
 *
 * The columns are written by this same service, so corrupt JSON means the database was touched
 * from outside (a downgrade, a manual fix, disk corruption). Listing must degrade to the empty
 * sides, never throw: the review screen is where the user goes to repair sync state, and it
 * cannot itself be broken by that state.
 */
describe('a conflict row with unreadable JSON', () => {
  it('lists it with empty sides instead of throwing', async () => {
    await database.db.insert(schema.syncConflicts).values({
      id: 'conflict-corrupt',
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: ENTITY_ID,
      reason: 'version_conflict',
      localOperationType: 'update',
      localOperationIds: '[oops',
      localValues: 'not json{{{',
      serverValues: 'also bad',
      clientVersion: 1,
      serverVersion: 3,
      message: null,
      status: 'pending',
      detectedAt: NOW,
    });

    const [pending] = await service.getPendingConflicts();

    expect(pending).toMatchObject({
      localValues: {},
      serverValues: null,
      localOperationIds: [],
      contestedFields: [],
    });
  });
});

/**
 * The two inputs `applyReorderToLocalDb` must ignore.
 *
 * An empty item list arrives from a server that accepted the reorder but has nothing to send
 * back; an unknown entity arrives from a newer server speaking about a collection this build
 * does not reorder. Both resolve through `resolveKeepServer` without writing anything.
 */
describe('reorder updates with nothing to apply', () => {
  it('ignores an empty item list', async () => {
    await database.db.insert(schema.chapters).values({
      id: 'chapter-1',
      storyId: STORY_ID,
      name: 'Capítulo 1',
      index: 1,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      isDeleted: false,
    });

    await expect(
      applyReorderToLocalDb(database.db, { entity: 'Chapter', reorderItems: [] } as never, NOW),
    ).resolves.toBeUndefined();

    const chapter = await database.db.query.chapters.findFirst();
    expect(chapter).toMatchObject({ index: 1, version: 1 });
  });

  it('ignores a reorder for an entity this build does not reorder', async () => {
    await database.db.insert(schema.chapters).values({
      id: 'chapter-1',
      storyId: STORY_ID,
      name: 'Capítulo 1',
      index: 1,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      isDeleted: false,
    });

    await expect(
      applyReorderToLocalDb(
        database.db,
        { entity: 'Scene', reorderItems: [{ id: 'x', newIndex: 9 }] } as never,
        NOW,
      ),
    ).resolves.toBeUndefined();

    const chapter = await database.db.query.chapters.findFirst();
    expect(chapter).toMatchObject({ index: 1, version: 1 });
  });
});

/**
 * What a folded conflict keeps from the first recording.
 *
 * The second push only brings fresher information; when it carries no server side at all (a
 * bare refusal with no versions), the values already stored stay. Overwriting them with null
 * would blank the comparison the screen shows.
 */
describe('folding a conflict that brings no server side', () => {
  it('keeps the stored server values and versions', async () => {
    await service.recordConflict(
      baseConflict({
        serverValues: { name: 'Nome do servidor' },
        clientVersion: 1,
        serverVersion: 3,
      }),
    );

    await service.recordConflict({
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: ENTITY_ID,
      reason: 'concurrent_edit',
      localOperationType: 'update',
      localOperationIds: [],
      localValues: { name: 'Mais novo' },
    });

    const pending = await service.getPendingConflicts();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      reason: 'concurrent_edit',
      localValues: { name: 'Mais novo' },
      serverValues: { name: 'Nome do servidor' },
      clientVersion: 1,
      serverVersion: 3,
    });
  });

  it('stores a missing client version as null', async () => {
    await service.recordConflict({
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: ENTITY_ID,
      reason: 'version_conflict',
      localOperationType: 'update',
      localOperationIds: [],
      localValues: { name: 'Meu nome' },
      serverValues: { name: 'Nome do servidor' },
      serverVersion: 3,
    });

    expect((await service.getPendingConflicts())[0].clientVersion).toBeNull();
  });
});

/**
 * A validation quarantine carries no server information, only newly blocked operations. Folded
 * into a real conflict it must contribute its operation ids and local values without demoting
 * the decidable conflict into an unpushable discard.
 */
describe('folding a validation quarantine into a pending conflict', () => {
  it('keeps the real conflict decidable when a quarantine joins it', async () => {
    await seedOperation('op-real', { operationType: 'update', operationVersion: 1 });
    await seedOperation('op-quarantined', { operationType: 'delete', operationVersion: 2 });
    await service.recordConflict(
      baseConflict({
        reason: 'version_conflict',
        localOperationType: 'update',
        localOperationIds: ['op-real'],
        serverValues: { name: 'Nome do servidor' },
        clientVersion: 1,
        serverVersion: 3,
      }),
    );
    await service.recordConflict(
      baseConflict({
        reason: 'validation',
        localOperationType: 'delete',
        localOperationIds: ['op-quarantined'],
        localValues: { name: 'Quarantined edit' },
        serverValues: null,
        serverVersion: null,
      }),
    );

    const [pending] = await service.getPendingConflicts();
    expect(pending).toMatchObject({
      reason: 'version_conflict',
      localOperationType: 'update',
      serverValues: { name: 'Nome do servidor' },
      clientVersion: 1,
      serverVersion: 3,
      localValues: { name: 'Quarantined edit' },
    });
    expect(pending.localOperationIds).toEqual(
      expect.arrayContaining(['op-real', 'op-quarantined']),
    );
  });

  it('upgrades a quarantine when a real conflict arrives for the same entity', async () => {
    await seedOperation('op-quarantined', { operationType: 'update', operationVersion: 1 });
    await seedOperation('op-real', { operationType: 'update', operationVersion: 2 });
    await service.recordConflict(
      baseConflict({
        reason: 'validation',
        localOperationIds: ['op-quarantined'],
        serverValues: null,
        serverVersion: null,
      }),
    );
    await service.recordConflict(
      baseConflict({
        reason: 'version_conflict',
        localOperationIds: ['op-real'],
        serverValues: { name: 'Nome do servidor' },
        serverVersion: 3,
      }),
    );

    const [pending] = await service.getPendingConflicts();
    expect(pending).toMatchObject({
      reason: 'version_conflict',
      serverValues: { name: 'Nome do servidor' },
      serverVersion: 3,
    });
    expect(pending.localOperationIds).toEqual(
      expect.arrayContaining(['op-quarantined', 'op-real']),
    );
  });

  it('merges a second quarantine into the pending one', async () => {
    await seedOperation('op-q1', { operationType: 'update', operationVersion: 1 });
    await seedOperation('op-q2', { operationType: 'update', operationVersion: 2 });
    await service.recordConflict(
      baseConflict({
        reason: 'validation',
        localOperationIds: ['op-q1'],
        serverValues: null,
        serverVersion: null,
      }),
    );
    await service.recordConflict(
      baseConflict({
        reason: 'validation',
        localOperationIds: ['op-q2'],
        serverValues: null,
        serverVersion: null,
      }),
    );

    const pending = await service.getPendingConflicts();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ reason: 'validation', serverValues: null });
    expect(pending[0].localOperationIds).toEqual(expect.arrayContaining(['op-q1', 'op-q2']));
  });
});

/**
 * Falling back through the version chain.
 *
 * The server does not always send its version: on a bare refusal `serverVersion` is null and
 * the only version available may be the one embedded in `serverValues` - or none at all, in
 * which case the entity restarts at 1. Each fallback writes a different local version, and
 * writing the wrong one either conflicts again immediately or silently forks the history.
 */
describe('resolving without a server version', () => {
  it('restarts at version 1 when the server has neither the entity nor a version', async () => {
    await seedCharacter();
    await service.recordConflict(
      baseConflict({ reason: 'not_found', serverValues: null, serverVersion: null }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    expect(await readCharacter()).toMatchObject({ isDeleted: true, version: 1 });
  });

  it('takes the version embedded in the server values when no top-level version came', async () => {
    await seedCharacter({ name: 'Meu nome' });
    await service.recordConflict(
      baseConflict({
        serverValues: { name: 'Nome do servidor', version: 5 },
        serverVersion: null,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    expect(await readCharacter()).toMatchObject({ name: 'Nome do servidor', version: 5 });
  });

  it('restarts at version 1 when no version came from anywhere', async () => {
    await seedCharacter({ name: 'Meu nome' });
    await service.recordConflict(
      baseConflict({ serverValues: { name: 'Nome do servidor' }, serverVersion: null }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    expect(await readCharacter()).toMatchObject({ name: 'Nome do servidor', version: 1 });
  });

  it('rebases a reorder onto zero when the server sent no version', async () => {
    const opId = await seedOperation('op-reorder', {
      operationType: 'reorder',
      entityType: 'Chapter',
      entityId: 'chapter-1',
      payload: JSON.stringify({ reorderItems: [{ id: 'scene-a', newIndex: 1 }], version: 1 }),
    });
    await service.recordConflict({
      storyId: STORY_ID,
      entityType: 'Chapter',
      entityId: 'chapter-1',
      reason: 'concurrent_edit',
      localOperationType: 'reorder',
      localOperationIds: [opId],
      localValues: { reorderItems: [{ id: 'scene-a', newIndex: 1 }] },
      serverValues: { reorderItems: [{ id: 'scene-a', newIndex: 1 }] },
      clientVersion: 1,
      serverVersion: null,
    });
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    const op = await readOperation(opId);
    expect(op!.conflictState).toBeNull();
    expect(JSON.parse(op!.payload).version).toBe(1);
    expect(await service.getPendingConflicts()).toEqual([]);
  });
});

/**
 * Keeping a create for an entity this client does not store.
 *
 * The update path for an unknown entity is covered above; the create path additionally reads
 * back the local row to rebuild the payload, and that read finds no table. The resent create
 * then carries only the conflict's own values - still a valid attempt, still versioned from
 * zero.
 */
describe('keeping a create for an unknown entity', () => {
  it('resends the conflict values as a create without reading any table', async () => {
    await service.recordConflict(
      baseConflict({
        entityType: 'SomethingFromTheFuture',
        entityId: 'x-1',
        localOperationType: 'create',
        serverValues: null,
        serverVersion: null,
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    const [queued] = await pushableOperations();
    expect(queued.operationType).toBe('create');
    expect(JSON.parse(queued.payload)).toMatchObject({
      name: 'Meu nome',
      isDeleted: false,
      version: 1,
    });
    const [row] = await database.db.query.syncConflicts.findMany();
    expect(row).toMatchObject({ status: 'resolved', resolution: 'keep_local' });
  });
});

/**
 * Rebasing onto a story row that is gone.
 *
 * The story can be deleted locally while its conflicts are still pending (delete the story on
 * this device, then open the review sheet from a stale notification). The rebased operation
 * cannot take the user or the next version from a row that is not there, so it falls back to
 * the local user and version 1 rather than failing the resolution.
 */
describe('keeping local when the story row is gone', () => {
  it('records the rebased operation as the local user at version 1', async () => {
    await seedCharacter();
    await service.recordConflict(baseConflict());
    await database.db.delete(schema.stories).where(eq(schema.stories.id, STORY_ID));
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepLocal(pending.id);

    const [queued] = await pushableOperations();
    expect(queued).toMatchObject({ userId: 'local_user', operationVersion: 1 });
    expect(await service.getPendingConflicts()).toEqual([]);
  });
});

/**
 * A validation quarantine has no server snapshot: `serverValues: null` means "unknown", not
 * "absent". Neither resolution can resend an unpushable payload or restore a copy that was never
 * fetched, so both discard the operation and leave the row untouched, at its current version.
 */
describe('validation quarantine without a server snapshot', () => {
  const seedValidationConflict = async (overrides: Partial<RecordConflictInput> = {}) => {
    await seedOperation('op-quarantined', {
      operationType: overrides.localOperationType ?? 'update',
    });
    await service.recordConflict(
      baseConflict({
        reason: 'validation',
        serverValues: null,
        serverVersion: null,
        localOperationIds: ['op-quarantined'],
        ...overrides,
      }),
    );
    const [pending] = await service.getPendingConflicts();
    return pending;
  };

  it('keepServer discards the operation and leaves the row at its version', async () => {
    await seedCharacter();
    const pending = await seedValidationConflict();

    await service.resolveKeepServer(pending.id);

    expect(await readCharacter()).toMatchObject({
      name: 'Original',
      version: 1,
      isDeleted: false,
    });
    expect(await pushableOperations()).toEqual([]);
    expect(await service.getPendingConflicts()).toEqual([]);
  });

  it('keepLocal discards the operation instead of rebasing an unpushable payload', async () => {
    await seedCharacter();
    const pending = await seedValidationConflict();

    await service.resolveKeepLocal(pending.id);

    expect(await readCharacter()).toMatchObject({
      name: 'Original',
      version: 1,
      isDeleted: false,
    });
    expect(await pushableOperations()).toEqual([]);
    expect(await service.getPendingConflicts()).toEqual([]);
  });

  it('restores the live flags when the discarded operation was a delete', async () => {
    await seedCharacter({ version: 2, isDeleted: true, deletedAt: NOW });
    const pending = await seedValidationConflict({ localOperationType: 'delete' });

    await service.resolveKeepServer(pending.id);

    expect(await readCharacter()).toMatchObject({
      version: 2,
      isDeleted: false,
      deletedAt: null,
    });
    expect(await service.getPendingConflicts()).toEqual([]);
  });

  it('resolves a delete quarantine whose row is already gone', async () => {
    const pending = await seedValidationConflict({ localOperationType: 'delete' });

    await service.resolveKeepLocal(pending.id);

    expect(await readCharacter()).toBeUndefined();
    expect(await service.getPendingConflicts()).toEqual([]);
  });

  it('still restores the server copy when a validation conflict carries one', async () => {
    await seedCharacter();
    await seedOperation('op-refused', { operationType: 'update' });
    await service.recordConflict(
      baseConflict({
        reason: 'validation',
        serverValues: { name: 'Server copy' },
        serverVersion: 3,
        localOperationIds: ['op-refused'],
      }),
    );
    const [pending] = await service.getPendingConflicts();

    await service.resolveKeepServer(pending.id);

    expect(await readCharacter()).toMatchObject({ name: 'Server copy', version: 3 });
    expect(await service.getPendingConflicts()).toEqual([]);
  });
});
