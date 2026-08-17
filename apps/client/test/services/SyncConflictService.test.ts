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
 * Esta tabela é a razão de o cliente não perder mais o trabalho feito offline. Enquanto o
 * conflito está pendente, as operações locais ficam fora do push - nem reenviadas em loop, nem
 * descartadas em silêncio. As duas resoluções precisam sempre terminar destravando aquelas
 * operações; um conflito que fecha deixando operação `conflicted` para trás prende a edição
 * do usuário para sempre.
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

  /** Um conflito é por entidade: cinco edições offline da mesma cena são uma decisão só. */
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
   * Rebasear é o que faz "manter o meu" funcionar: a edição é reenviada apoiada na versão que
   * o servidor tem agora, então passa na checagem de concorrência em vez de conflitar de novo.
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
   * Uma entidade que o servidor nunca teve precisa voltar como `create`. Reenviar `update`
   * traria de volta o mesmo `not_found` a cada ciclo - o laço que prendia uma GalleryRelation
   * para sempre quando o dono dela ainda não existia no servidor.
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

  /** Aceitar que o servidor não tem a entidade é removê-la aqui - sem gravar operação. */
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
});

/**
 * Reorder não tem uma linha de entidade só pra "a ordem" - o valor em disputa é
 * `reorderItems`, que mexe em N linhas de outra tabela (Scenes de um Chapter). Por isso as
 * duas resoluções não passam pelo caminho genérico de `writeEntity`/`recordRebasedOperation`.
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

    // A ordem local não foi tocada - "manter a minha" para reorder não escreve nas Scenes,
    // só libera a operação pendente pra ser reenviada.
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
   * Sem soltar as operações, dispensar só esconderia o conflito da lista enquanto as edições
   * continuariam `conflicted` para sempre - fora de todo push futuro, sem forma de resolver.
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
   * A chave tem que estar *presente* no lado do servidor. No pull, `serverValues` traz só o
   * que a operação remota mudou: um campo ausente significa que o servidor não opinou, e
   * compará-lo com `undefined` marcaria como disputado o que deveria mesclar em silêncio.
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

  /** Operações mais novas vêm depois e ganham: é a última intenção do usuário. */
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
