/**
 * @jest-environment node
 */
import { and, eq } from 'drizzle-orm';
import type { SyncConflict } from '@keres/shared';
import * as schema from '../../src/db/schema';
import type { OperationLogSelect } from '../../src/db/schema';
import { foldIntoTwin, isFoldableDuplicate } from '../../src/services/sync/duplicateFold';
import type { SyncContext } from '../../src/services/sync/SyncContext';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');
const MINE = 'TAGMINE00000000000000000';
const TWIN = 'TAGTWIN00000000000000000';

let database: TestDatabase;
let recordConflict: jest.Mock;
let context: SyncContext;

const operation = (
  id: string,
  operationType: OperationLogSelect['operationType'],
  overrides: Partial<OperationLogSelect> = {},
): OperationLogSelect =>
  ({
    id,
    storyId: STORY_ID,
    userId: 'local-user',
    operationVersion: 1,
    operationType,
    entityType: 'Tag',
    entityId: MINE,
    payload: JSON.stringify({ name: 'Mine', version: 2 }),
    createdAt: NOW,
    isSynced: false,
    serverOperationVersion: null,
    conflictState: null,
    ...overrides,
  }) as OperationLogSelect;

let nextVersion = 1;
const seedOperation = (value: OperationLogSelect) =>
  database.db.insert(schema.operationLogs).values({ ...value, operationVersion: nextVersion++ });

const seedTag = (id: string, overrides: Record<string, unknown> = {}) =>
  database.db.insert(schema.tags).values({
    id,
    storyId: STORY_ID,
    name: 'Mine',
    createdAt: NOW,
    updatedAt: NOW,
    version: 2,
    isDeleted: false,
    ...overrides,
  } as never);

const seedRelation = (id: string, overrides: Record<string, unknown> = {}) =>
  database.db.insert(schema.tagRelations).values({
    id,
    storyId: STORY_ID,
    tagId: MINE,
    relationId: 'CHARACTER1',
    relationType: 'Character',
    createdAt: NOW,
    updatedAt: NOW,
    version: 3,
    isDeleted: false,
    ...overrides,
  } as never);

const twin = (overrides: Record<string, unknown> = {}) => ({
  id: TWIN,
  name: 'Server',
  version: 5,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides,
});

const tagRow = (id: string) =>
  database.db.select().from(schema.tags).where(eq(schema.tags.id, id)).get();
const relationRow = (id: string) =>
  database.db.select().from(schema.tagRelations).where(eq(schema.tagRelations.id, id)).get();
const opRow = (id: string) =>
  database.db.query.operationLogs.findFirst({ where: eq(schema.operationLogs.id, id) });

beforeEach(async () => {
  database = await createTestDatabase();
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'Story',
    type: 'linear',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    lastOperationLog: 100,
    isDeleted: false,
  });
  nextVersion = 1;
  recordConflict = jest.fn().mockResolvedValue(undefined);
  context = {
    db: () => database.db,
    storyId: () => STORY_ID,
    client: jest.fn() as never,
    conflictService: () => ({ recordConflict }) as never,
    notifier: () => ({}) as never,
    abortSignal: () => new AbortController().signal,
  } as SyncContext;
});

afterEach(() => database.close());

describe('isFoldableDuplicate', () => {
  const conflict = (overrides: Partial<SyncConflict> = {}) =>
    ({
      reason: 'duplicate',
      entityId: MINE,
      serverEntity: { id: TWIN },
      ...overrides,
    }) as SyncConflict;

  it('accepts a duplicate that names a different live twin', () => {
    expect(isFoldableDuplicate(conflict())).toBe(true);
  });

  it.each([
    ['another reason', { reason: 'concurrent_edit' }],
    ['no twin named', { serverEntity: undefined }],
    ['a twin without an id', { serverEntity: {} }],
    ['a twin that is the row itself', { serverEntity: { id: MINE } }],
  ])('refuses %s', (_name, overrides) => {
    expect(isFoldableDuplicate(conflict(overrides as Partial<SyncConflict>))).toBe(false);
  });
});

describe('foldIntoTwin', () => {
  it('does nothing for an entity type that has no table', async () => {
    await expect(foldIntoTwin(context, 'Nope', MINE, twin(), [])).resolves.toEqual(new Set());
    expect(recordConflict).not.toHaveBeenCalled();
  });

  it('drops a row the server never saw, repoints its queued references and asks about differences', async () => {
    const create = operation('tag-create', 'create', {
      payload: JSON.stringify({ name: 'Mine', color: '#fff', version: 1 }),
    });
    await seedTag(MINE, { version: 1, color: '#fff' });
    await seedOperation(create);
    await seedRelation('rel-new', { version: 1 });
    await seedOperation(
      operation('rel-create', 'create', {
        entityType: 'TagRelation',
        entityId: 'rel-new',
        payload: JSON.stringify({ tagId: MINE, version: 1 }),
      }),
    );
    // Queued operations that do not carry the reference (or cannot be read) are left alone.
    await seedOperation(
      operation('rel-other', 'update', {
        entityType: 'TagRelation',
        entityId: 'rel-new',
        payload: JSON.stringify({ relationId: 'X', version: 2 }),
      }),
    );
    await seedOperation(
      operation('rel-corrupt', 'update', {
        entityType: 'TagRelation',
        entityId: 'rel-new',
        payload: '{nope',
      }),
    );
    await seedOperation(
      operation('rel-scalar', 'update', {
        entityType: 'TagRelation',
        entityId: 'rel-new',
        payload: 'null',
      }),
    );

    const rewritten = await foldIntoTwin(context, 'Tag', MINE, twin({ color: '#000' }), [create]);

    expect(rewritten).toEqual(new Set(['rel-create']));
    expect(JSON.parse((await opRow('rel-create'))!.payload)).toEqual({ tagId: TWIN, version: 1 });
    expect((await opRow('rel-corrupt'))!.payload).toBe('{nope');
    expect((await relationRow('rel-new'))!.tagId).toBe(TWIN);
    // The twin is here, this row is not, and its create is settled.
    expect(await tagRow(MINE)).toBeUndefined();
    expect(await tagRow(TWIN)).toMatchObject({ name: 'Server', isDeleted: false });
    expect(await opRow('tag-create')).toMatchObject({ isSynced: true, conflictState: 'abandoned' });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: TWIN,
        reason: 'concurrent_edit',
        localValues: { name: 'Mine', color: '#fff' },
        serverVersion: 5,
      }),
    );
  });

  it('tombstones a row the server holds live and moves the rows it pointed at as edits', async () => {
    await seedTag(MINE);
    await seedTag(TWIN, { name: 'Server', version: 5 });
    await seedRelation('rel-old');
    await seedRelation('rel-deleted', { isDeleted: true });
    await seedRelation('rel-elsewhere', { tagId: 'OTHERTAG' });
    await seedOperation(
      operation('rel-synced', 'update', {
        entityType: 'TagRelation',
        entityId: 'rel-old',
        isSynced: true,
        payload: JSON.stringify({ tagId: MINE, version: 3 }),
      }),
    );
    const edit = operation('tag-edit', 'update', {
      payload: JSON.stringify({ name: 'Mine', version: 2 }),
    });
    await seedOperation(edit);

    await foldIntoTwin(context, 'Tag', MINE, twin(), [edit], {
      id: MINE,
      name: 'Own',
      version: 4,
      isDeleted: false,
    });

    expect(await tagRow(MINE)).toMatchObject({ isDeleted: true, version: 5, name: 'Own' });
    expect(await relationRow('rel-old')).toMatchObject({ tagId: TWIN, version: 4 });
    expect((await relationRow('rel-deleted'))!.tagId).toBe(MINE);
    expect((await relationRow('rel-elsewhere'))!.tagId).toBe('OTHERTAG');
    const queued = await database.db.query.operationLogs.findMany({
      where: and(
        eq(schema.operationLogs.isSynced, false),
        eq(schema.operationLogs.storyId, STORY_ID),
      ),
    });
    expect(
      queued.map((op) => `${op.operationType}:${op.entityType}:${op.entityId}`).sort(),
    ).toEqual(['delete:Tag:' + MINE, 'update:TagRelation:rel-old']);
    // A twin already held is not written again.
    expect((await tagRow(TWIN))!.name).toBe('Server');
  });

  it('puts a restored row back to the tombstone the server keeps', async () => {
    await seedTag(MINE, { isDeleted: false });
    const restore = operation('tag-restore', 'update', {
      payload: JSON.stringify({ isDeleted: false, version: 3 }),
    });
    await seedOperation(restore);

    await foldIntoTwin(context, 'Tag', MINE, twin(), [restore], {
      id: MINE,
      name: 'Gone',
      version: 6,
      isDeleted: true,
      deletedAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });

    expect(await tagRow(MINE)).toMatchObject({ isDeleted: true, version: 6, name: 'Gone' });
    const queued = await database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.isSynced, false),
    });
    expect(queued).toEqual([]);
  });

  it('falls back to the current time for a tombstone that carries no dates', async () => {
    await seedTag(MINE);
    await foldIntoTwin(context, 'Tag', MINE, twin(), [], {
      id: MINE,
      name: 'Gone',
      version: 6,
      isDeleted: true,
    });
    expect((await tagRow(MINE))!.isDeleted).toBe(true);
  });

  it('derives the version of the delete from the queued operation when the server row is not given', async () => {
    await seedTag(MINE, { version: 2 });
    const edit = operation('tag-edit', 'update', {
      payload: JSON.stringify({ name: 'Mine', version: 7 }),
    });
    await seedOperation(edit);

    await foldIntoTwin(context, 'Tag', MINE, twin(), [edit]);

    expect((await tagRow(MINE))!.version).toBe(7);
  });

  it('counts from the local version when nothing tells the server version', async () => {
    await seedTag(MINE, { version: 4 });

    await foldIntoTwin(context, 'Tag', MINE, twin(), []);

    expect(await tagRow(MINE)).toMatchObject({ isDeleted: true, version: 5 });
  });

  it('counts from the local version when the queued payload is unreadable', async () => {
    await seedTag(MINE, { version: 4 });
    const broken = operation('tag-broken', 'update', { payload: '{nope' });
    await seedOperation(broken);

    await foldIntoTwin(context, 'Tag', MINE, twin(), [broken]);

    expect((await tagRow(MINE))!.version).toBe(5);
  });

  it('leaves a row that is already gone alone', async () => {
    await foldIntoTwin(context, 'Tag', MINE, twin(), []);
    expect(await tagRow(MINE)).toBeUndefined();
    expect(await tagRow(TWIN)).toBeDefined();
  });

  it('asks nothing when this device only deleted the row or agrees with the twin', async () => {
    await seedTag(MINE);
    const remove = operation('tag-delete', 'delete', {
      payload: JSON.stringify({ isDeleted: true, version: 2 }),
    });
    await seedOperation(remove);
    await foldIntoTwin(context, 'Tag', MINE, twin(), [remove]);

    await seedTag('TAGAGREE', { name: 'Server' });
    const agree = operation('tag-agree', 'create', {
      entityId: 'TAGAGREE',
      payload: JSON.stringify({ name: 'Server', version: 1 }),
    });
    await seedOperation(agree);
    await foldIntoTwin(context, 'Tag', 'TAGAGREE', twin(), [agree]);

    expect(recordConflict).not.toHaveBeenCalled();
  });

  it('asks about a twin that reports no version', async () => {
    const create = operation('tag-create', 'create', {
      payload: JSON.stringify({ name: 'Mine', color: '#000', version: 1 }),
    });
    await seedTag(MINE, { version: 1 });
    await seedTag(TWIN, { name: 'Server' });
    await seedOperation(create);

    await foldIntoTwin(context, 'Tag', MINE, { id: TWIN, name: 'Server', color: '#111' }, [create]);

    expect(recordConflict).toHaveBeenCalledWith(expect.objectContaining({ serverVersion: null }));
  });

  it('repoints polymorphic references by their type and id pair', async () => {
    await seedTag(MINE);
    await database.db.insert(schema.favorites).values({
      id: 'fav-1',
      storyId: STORY_ID,
      entityId: MINE,
      entityType: 'Tag',
      userId: 'local-user',
      createdAt: NOW,
      updatedAt: NOW,
      version: 2,
      isDeleted: false,
    } as never);
    await database.db.insert(schema.favorites).values({
      id: 'fav-other',
      storyId: STORY_ID,
      entityId: MINE,
      entityType: 'Character',
      userId: 'local-user',
      createdAt: NOW,
      updatedAt: NOW,
      version: 2,
      isDeleted: false,
    } as never);

    await foldIntoTwin(context, 'Tag', MINE, twin(), []);

    const favorite = await database.db
      .select()
      .from(schema.favorites)
      .where(eq(schema.favorites.id, 'fav-1'))
      .get();
    const other = await database.db
      .select()
      .from(schema.favorites)
      .where(eq(schema.favorites.id, 'fav-other'))
      .get();
    expect(favorite).toMatchObject({ entityId: TWIN, version: 3 });
    expect(other!.entityId).toBe(MINE);
  });

  it('records operations under a fallback user when the story is not here', async () => {
    await seedTag(MINE);
    await seedRelation('rel-old');
    await database.db.delete(schema.stories).run();
    // The story is gone: the queued edit of the moved row cannot be recorded.
    await expect(foldIntoTwin(context, 'Tag', MINE, twin(), [])).rejects.toThrow('not here');
  });
});
