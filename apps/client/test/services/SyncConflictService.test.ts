/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import {
  createSyncConflictService,
  findContestedFields,
  mergeLocalOperationPayloads,
  type RecordConflictInput,
} from '../../src/services/SyncConflictService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

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
    await seedOperation('op-2');
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
   * it anyway only creates a new log entry with no actually new information. The local version still has
   * to advance (so it does not conflict again on the next edit), it is only the new operation that should
   * not exist.
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
    expect(await readCharacter()).toMatchObject({ name: 'Mesmo Nome', version: 4 });
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
 * `writeEntity`/`recordRebasedOperation` path.
 */
describe('reorder conflicts', () => {
  const CHAPTER_ID = 'chapter-1';

  async function seedChapterWithScenes() {
    await database.db.insert(schema.chapters).values({
      id: CHAPTER_ID,
      storyId: STORY_ID,
      name: 'Capítulo 1',
      index: 1,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
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
        version: 1,
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
        version: 1,
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

    // The local order was untouched - "keep mine" for a reorder writes nothing to the Scenes, it only
    // releases the pending operation to be resent.
    const sceneA = await database.db.query.scenes.findFirst({
      where: eq(schema.scenes.id, 'scene-a'),
    });
    expect(sceneA!.index).toBe(2);
  });

  it('shows no field-by-field picker for a reorder conflict, since reorderItems is not a scalar field', async () => {
    await seedChapterWithScenes();
    await seedReorderConflict();

    const [pending] = await service.getPendingConflicts();

    expect(pending.contestedFields).toEqual([]);
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
    expect(await service.getPendingConflicts()).toEqual([]);
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
