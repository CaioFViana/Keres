import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db';
import {
  chapterAnchors,
  chapters,
  characters,
  notes,
  operationLog,
  scenes,
  stories,
  users,
} from '../../src/db/schema';
import {
  adminRecoveryService,
  RecoveryEntityNotFoundError,
  UnknownEntityTypeError,
} from '../../src/services/AdminRecoveryService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

const ids = {
  ana: '',
  beto: '',
  storyA: '',
  storyB: '',
  storyC: '',
  lia: '',
  rui: '',
  note: '',
  chapter: '',
  scene: '',
  anchor: '',
};

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

beforeEach(async () => {
  await truncateAll();
  for (const key of Object.keys(ids) as Array<keyof typeof ids>) ids[key] = newId();

  await db.insert(users).values([
    { id: ids.ana, username: 'ana', tag: 'ana', password: 'x' },
    { id: ids.beto, username: 'beto', tag: 'beto', password: 'x' },
  ] as never);
  await db.insert(stories).values([
    {
      id: ids.storyA,
      userId: ids.ana,
      title: 'A Queda',
      type: 'branching',
      version: 1,
      lastOperationVersion: 2,
    },
    {
      id: ids.storyB,
      userId: ids.ana,
      title: 'O Farol',
      type: 'linear',
      version: 1,
      isDeleted: true,
      deletedAt: day(5),
    },
    {
      id: ids.storyC,
      userId: ids.beto,
      title: '   ',
      type: 'linear',
      version: 1,
      lastOperationVersion: 1,
    },
  ] as never);
  await db.insert(characters).values([
    { id: ids.lia, storyId: ids.storyA, name: 'Lia', isDeleted: true, deletedAt: day(10) },
    { id: ids.rui, storyId: ids.storyA, name: 'Rui' },
  ] as never);
  await db.insert(notes).values({
    id: ids.note,
    storyId: ids.storyC,
    title: 'Pesquisa',
    isDeleted: true,
    deletedAt: null,
  } as never);
  await db
    .insert(chapters)
    .values({ id: ids.chapter, storyId: ids.storyA, name: 'Capítulo 1', index: 1 } as never);
  await db.insert(scenes).values({
    id: ids.scene,
    storyId: ids.storyA,
    chapterId: ids.chapter,
    name: 'A chegada',
    index: 1,
  } as never);
  await db.insert(chapterAnchors).values({
    id: ids.anchor,
    storyId: ids.storyA,
    chapterId: ids.chapter,
    startSceneId: ids.scene,
    isDeleted: true,
    deletedAt: day(12),
  } as never);
  await db.insert(operationLog).values([
    {
      id: newId(),
      storyId: ids.storyA,
      userId: ids.ana,
      operationVersion: 1,
      operationType: 'create',
      entityType: 'Character',
      entityId: ids.lia,
      entityVersion: 1,
      payload: { name: 'Lia' },
      createdAt: day(3),
    },
    {
      id: newId(),
      storyId: ids.storyA,
      userId: ids.beto,
      operationVersion: 2,
      operationType: 'update',
      entityType: 'Note',
      entityId: ids.note,
      entityVersion: 2,
      payload: { title: 'Pesquisa' },
      createdAt: day(4),
    },
    {
      id: newId(),
      storyId: ids.storyC,
      userId: ids.ana,
      operationVersion: 1,
      operationType: 'delete',
      entityType: 'Character',
      entityId: ids.rui,
      entityVersion: 2,
      payload: {},
      createdAt: day(6),
    },
  ] as never);
});

describe('listDeleted', () => {
  it('sweeps every tombstone, newest deletion first and unknowns last', async () => {
    const items = await adminRecoveryService.listDeleted({});

    expect(items.map((item) => item.id)).toEqual([ids.anchor, ids.lia, ids.storyB, ids.note]);
    expect(items[1]).toMatchObject({
      entityType: 'Character',
      storyId: ids.storyA,
      storyTitle: 'A Queda',
      name: 'Lia',
      version: 1,
    });
    // ChapterAnchor has neither a simple name nor a composite: the panel shows a blank.
    expect(items[0]).toMatchObject({ entityType: 'ChapterAnchor', name: null });
    // A story tombstone carries no storyId, but still resolves its own title.
    expect(items[2]).toMatchObject({
      entityType: 'Story',
      storyId: null,
      storyTitle: 'O Farol',
      name: 'O Farol',
    });
    // A blank story title resolves to nothing.
    expect(items[3]).toMatchObject({ entityType: 'Note', storyTitle: null, name: 'Pesquisa' });
  });

  it('restricts the sweep to one entity type, or to nothing when it is unknown', async () => {
    expect(await adminRecoveryService.listDeleted({ entityType: 'Character' })).toEqual([
      expect.objectContaining({ id: ids.lia }),
    ]);
    expect(await adminRecoveryService.listDeleted({ entityType: 'Bogus' })).toEqual([]);
  });

  it('keeps unrelated deleted stories out of a story-scoped sweep', async () => {
    const items = await adminRecoveryService.listDeleted({ storyId: ids.storyA });

    expect(items.map((item) => item.id).sort()).toEqual([ids.anchor, ids.lia].sort());
  });

  it('searches across name, title, id, type and story', async () => {
    expect(
      (await adminRecoveryService.listDeleted({ search: 'lia' })).map((item) => item.id),
    ).toEqual([ids.lia]);
    expect(
      (await adminRecoveryService.listDeleted({ search: 'queda' })).map((item) => item.id).sort(),
    ).toEqual([ids.anchor, ids.lia].sort());
    expect(
      (await adminRecoveryService.listDeleted({ search: ids.note })).map((item) => item.id),
    ).toEqual([ids.note]);
    expect(
      (await adminRecoveryService.listDeleted({ search: 'chapteranchor' })).map((item) => item.id),
    ).toEqual([ids.anchor]);
    expect(
      (await adminRecoveryService.listDeleted({ search: ids.storyA }))
        .map((item) => item.id)
        .sort(),
    ).toEqual([ids.anchor, ids.lia].sort());
    expect(await adminRecoveryService.listDeleted({ search: 'zzz-sem-nada' })).toEqual([]);
    expect(
      (await adminRecoveryService.listDeleted({ search: '  lia  ' })).map((item) => item.id),
    ).toEqual([ids.lia]);
  });
});

describe('restore', () => {
  it('restores a character and records the admin in the operation log', async () => {
    const restored = await adminRecoveryService.restore('Character', ids.lia, ids.beto);

    expect(restored).toMatchObject({ id: ids.lia, isDeleted: false });
    const row = await db.query.characters.findFirst({ where: eq(characters.id, ids.lia) });
    expect(row?.isDeleted).toBe(false);
    const entries = await db.query.operationLog.findMany({
      where: and(eq(operationLog.entityId, ids.lia), eq(operationLog.userId, ids.beto)),
    });
    expect(entries).toEqual([
      expect.objectContaining({ operationType: 'update', storyId: ids.storyA }),
    ]);
    expect(await adminRecoveryService.listDeleted({ entityType: 'Character' })).toEqual([]);
  });

  it('restores a story addressed by its own id', async () => {
    const restored = await adminRecoveryService.restore('Story', ids.storyB, ids.ana);

    expect(restored).toMatchObject({ id: ids.storyB, isDeleted: false });
  });

  it('rejects unknown types and missing rows with typed errors', async () => {
    await expect(adminRecoveryService.restore('Bogus', newId(), ids.ana)).rejects.toThrow(
      UnknownEntityTypeError,
    );
    await expect(adminRecoveryService.restore('Story', newId(), ids.ana)).rejects.toThrow(
      RecoveryEntityNotFoundError,
    );
    await expect(adminRecoveryService.restore('Character', newId(), ids.ana)).rejects.toThrow(
      RecoveryEntityNotFoundError,
    );
  });
});

describe('browseOperationLog', () => {
  const page = { page: 1, pageSize: 25 };

  it('enriches every entry with entity, story and user labels', async () => {
    const { items, total } = await adminRecoveryService.browseOperationLog({
      ...page,
      storyId: ids.storyA,
      entityType: 'Character',
    });

    expect(total).toBe(1);
    expect(items).toEqual([
      expect.objectContaining({
        entityId: ids.lia,
        entityName: 'Lia',
        storyTitle: 'A Queda',
        username: 'ana',
      }),
    ]);
  });

  it('paginates newest first without a search', async () => {
    const first = await adminRecoveryService.browseOperationLog({ page: 1, pageSize: 2 });
    const second = await adminRecoveryService.browseOperationLog({ page: 2, pageSize: 2 });

    expect(first).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(first.items.map((item) => item.operationVersion)).toEqual([1, 2]);
    expect(first.items[0].storyId).toBe(ids.storyC);
    expect(second.items).toHaveLength(1);
    expect(second.items[0]).toMatchObject({ storyId: ids.storyA, operationVersion: 1 });
  });

  it('filters by user, operation type and date range', async () => {
    expect(
      (await adminRecoveryService.browseOperationLog({ ...page, userId: ids.beto })).items,
    ).toEqual([expect.objectContaining({ entityId: ids.note })]);
    expect(
      (await adminRecoveryService.browseOperationLog({ ...page, operationType: 'create' })).items,
    ).toEqual([expect.objectContaining({ entityId: ids.lia })]);
    expect(
      (await adminRecoveryService.browseOperationLog({ ...page, from: day(4) })).items.map(
        (item) => item.entityId,
      ),
    ).toEqual([ids.rui, ids.note]);
    expect(
      (await adminRecoveryService.browseOperationLog({ ...page, to: day(3) })).items.map(
        (item) => item.entityId,
      ),
    ).toEqual([ids.lia]);
    expect(
      (
        await adminRecoveryService.browseOperationLog({
          ...page,
          storyId: ids.storyA,
          operationType: 'update',
        })
      ).items,
    ).toEqual([expect.objectContaining({ entityId: ids.note })]);
    expect(
      await adminRecoveryService.browseOperationLog({ ...page, storyId: newId() }),
    ).toMatchObject({ items: [], total: 0 });
  });

  it('searches the enriched labels and the raw identifiers', async () => {
    const byUsername = await adminRecoveryService.browseOperationLog({ ...page, search: 'beto' });
    expect(byUsername.items).toEqual([expect.objectContaining({ entityId: ids.note })]);

    const byName = await adminRecoveryService.browseOperationLog({ ...page, search: 'pesquisa' });
    expect(byName.items).toEqual([expect.objectContaining({ entityId: ids.note })]);

    const byType = await adminRecoveryService.browseOperationLog({ ...page, search: 'note' });
    expect(byType.items).toEqual([expect.objectContaining({ entityId: ids.note })]);

    const byEntityId = await adminRecoveryService.browseOperationLog({
      ...page,
      search: ids.lia,
    });
    expect(byEntityId.items).toEqual([expect.objectContaining({ entityId: ids.lia })]);

    const byUserId = await adminRecoveryService.browseOperationLog({ ...page, search: ids.beto });
    expect(byUserId.items).toEqual([expect.objectContaining({ entityId: ids.note })]);

    const byStoryId = await adminRecoveryService.browseOperationLog({
      ...page,
      search: ids.storyC,
    });
    expect(byStoryId.items).toEqual([expect.objectContaining({ entityId: ids.rui })]);

    const byOperation = await adminRecoveryService.browseOperationLog({
      ...page,
      search: 'delete',
    });
    expect(byOperation.items).toEqual([expect.objectContaining({ entityId: ids.rui })]);

    expect(await adminRecoveryService.browseOperationLog({ ...page, search: 'zzz' })).toMatchObject(
      { items: [], total: 0 },
    );
  });

  it('paginates within the search results', async () => {
    const first = await adminRecoveryService.browseOperationLog({
      page: 1,
      pageSize: 1,
      search: 'ana',
    });
    const second = await adminRecoveryService.browseOperationLog({
      page: 2,
      pageSize: 1,
      search: 'ana',
    });

    expect(first).toMatchObject({ total: 2 });
    expect(first.items).toEqual([expect.objectContaining({ entityId: ids.rui })]);
    expect(second.items).toEqual([expect.objectContaining({ entityId: ids.lia })]);
  });
});
