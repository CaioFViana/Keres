import { asc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { chapters, locations, scenes, stories, users } from '../../src/db/schema';
import { SyncConflictError } from '../../src/services/entity-sync-handlers/BaseSyncEntityHandler';
import { ChapterSyncHandler } from '../../src/services/entity-sync-handlers/ChapterSyncHandler';
import { StorySyncHandler } from '../../src/services/entity-sync-handlers/StorySyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * Reordenar é o único caminho de `update` que os handlers de Chapter e Story escrevem por
 * conta própria, em vez de delegar à classe base: mexe em várias linhas numa transação e
 * recusa lotes inconsistentes. É esse caminho que este arquivo exercita.
 */
let userId: string;
let storyId: string;
let chapterId: string;
let locationId: string;
let sceneIds: string[];
let chapterIds: string[];

const chapterHandler = new ChapterSyncHandler();
const storyHandler = new StorySyncHandler();

function reorder(entity: 'Chapter' | 'Story', id: string, version: number, items: unknown[]) {
  return {
    type: 'reorder' as const,
    entity,
    id,
    version,
    reorderItems: items,
  } as never;
}

async function indexesOf(table: typeof scenes | typeof chapters, ids: string[]) {
  const rows = await db
    .select({ id: table.id, index: table.index, version: table.version })
    .from(table)
    .orderBy(asc(table.index));
  return ids.map((id) => rows.find((row) => row.id === id));
}

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  chapterId = newId();
  locationId = newId();
  sceneIds = [newId(), newId(), newId()];
  chapterIds = [chapterId, newId()];

  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db
    .insert(stories)
    .values({ id: storyId, userId, title: 'A ilha', type: 'linear' } as never);
  await db.insert(chapters).values([
    { id: chapterIds[0], storyId, name: 'Um', index: 1 },
    { id: chapterIds[1], storyId, name: 'Dois', index: 2 },
  ] as never);
  await db.insert(locations).values({ id: locationId, storyId, name: 'A praia' } as never);
  await db.insert(scenes).values(
    sceneIds.map((id, position) => ({
      id,
      storyId,
      chapterId,
      locationId,
      name: `Cena ${position + 1}`,
      index: position + 1,
    })) as never,
  );
});

describe('reordering the scenes of a chapter', () => {
  it('writes the new indices and bumps every version involved', async () => {
    const chapter = await chapterHandler.findById(chapterId);

    await chapterHandler.update(
      userId,
      storyId,
      reorder('Chapter', chapterId, chapter.version, [
        { id: sceneIds[0], newIndex: 3 },
        { id: sceneIds[1], newIndex: 1 },
        { id: sceneIds[2], newIndex: 2 },
      ]),
      chapter,
    );

    const after = await indexesOf(scenes, sceneIds);
    expect(after.map((row) => row?.index)).toEqual([3, 1, 2]);
    expect(after.every((row) => row?.version === 2)).toBe(true);
    expect((await chapterHandler.findById(chapterId)).version).toBe(chapter.version + 1);
  });

  it('refuses a batch that does not cover exactly the scenes of the chapter', async () => {
    const chapter = await chapterHandler.findById(chapterId);

    await expect(
      chapterHandler.update(
        userId,
        storyId,
        reorder('Chapter', chapterId, chapter.version, [
          { id: sceneIds[0], newIndex: 1 },
          { id: sceneIds[1], newIndex: 2 },
        ]),
        chapter,
      ),
    ).rejects.toThrow(SyncConflictError);

    expect((await indexesOf(scenes, sceneIds)).map((row) => row?.index)).toEqual([1, 2, 3]);
  });

  it('refuses repeated indices', async () => {
    const chapter = await chapterHandler.findById(chapterId);

    await expect(
      chapterHandler.update(
        userId,
        storyId,
        reorder('Chapter', chapterId, chapter.version, [
          { id: sceneIds[0], newIndex: 1 },
          { id: sceneIds[1], newIndex: 1 },
          { id: sceneIds[2], newIndex: 2 },
        ]),
        chapter,
      ),
    ).rejects.toThrow(/Duplicate newIndex/);
  });

  it('refuses indices with a gap or not starting at one', async () => {
    const chapter = await chapterHandler.findById(chapterId);

    await expect(
      chapterHandler.update(
        userId,
        storyId,
        reorder('Chapter', chapterId, chapter.version, [
          { id: sceneIds[0], newIndex: 2 },
          { id: sceneIds[1], newIndex: 3 },
          { id: sceneIds[2], newIndex: 4 },
        ]),
        chapter,
      ),
    ).rejects.toThrow(/sequential starting from 1/);
  });

  it('refuses a reorder built on a stale chapter version', async () => {
    const chapter = await chapterHandler.findById(chapterId);

    await expect(
      chapterHandler.update(
        userId,
        storyId,
        reorder('Chapter', chapterId, chapter.version - 1, [
          { id: sceneIds[0], newIndex: 1 },
          { id: sceneIds[1], newIndex: 2 },
          { id: sceneIds[2], newIndex: 3 },
        ]),
        chapter,
      ),
    ).rejects.toThrow(SyncConflictError);
  });

  it('still delegates a plain field update to the base handler', async () => {
    const chapter = await chapterHandler.findById(chapterId);

    await chapterHandler.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'Chapter',
        id: chapterId,
        version: chapter.version,
        changes: { version: chapter.version, name: 'Um, revisado' },
      } as never,
      chapter,
    );

    const updated = await chapterHandler.findById(chapterId);
    expect(updated.name).toBe('Um, revisado');
    expect(updated.version).toBe(chapter.version + 1);
  });
});

describe('reordering the chapters of a story', () => {
  it('writes the new indices and bumps every version involved', async () => {
    const story = await storyHandler.findById(storyId);

    await storyHandler.update(
      userId,
      storyId,
      reorder('Story', storyId, story.version, [
        { id: chapterIds[0], newIndex: 2 },
        { id: chapterIds[1], newIndex: 1 },
      ]),
      story,
    );

    const after = await indexesOf(chapters, chapterIds);
    expect(after.map((row) => row?.index)).toEqual([2, 1]);
    expect(after.every((row) => row?.version === 2)).toBe(true);
  });

  it('refuses a batch that does not cover exactly the chapters of the story', async () => {
    const story = await storyHandler.findById(storyId);

    await expect(
      storyHandler.update(
        userId,
        storyId,
        reorder('Story', storyId, story.version, [{ id: chapterIds[0], newIndex: 1 }]),
        story,
      ),
    ).rejects.toThrow(SyncConflictError);

    expect((await indexesOf(chapters, chapterIds)).map((row) => row?.index)).toEqual([1, 2]);
  });

  it('refuses repeated indices', async () => {
    const story = await storyHandler.findById(storyId);

    await expect(
      storyHandler.update(
        userId,
        storyId,
        reorder('Story', storyId, story.version, [
          { id: chapterIds[0], newIndex: 1 },
          { id: chapterIds[1], newIndex: 1 },
        ]),
        story,
      ),
    ).rejects.toThrow(/Duplicate newIndex/);
  });

  it('refuses indices with a gap or not starting at one', async () => {
    const story = await storyHandler.findById(storyId);

    await expect(
      storyHandler.update(
        userId,
        storyId,
        reorder('Story', storyId, story.version, [
          { id: chapterIds[0], newIndex: 2 },
          { id: chapterIds[1], newIndex: 3 },
        ]),
        story,
      ),
    ).rejects.toThrow(/sequential starting from 1/);
  });

  it('leaves the chapters untouched when the reorder fails', async () => {
    const story = await storyHandler.findById(storyId);
    await expect(
      storyHandler.update(
        userId,
        storyId,
        reorder('Story', storyId, story.version, [
          { id: chapterIds[0], newIndex: 1 },
          { id: newId(), newIndex: 2 },
        ]),
        story,
      ),
    ).rejects.toThrow(SyncConflictError);

    const rows = await db.select().from(chapters).where(eq(chapters.storyId, storyId));
    expect(rows.every((row) => row.version === 1)).toBe(true);
  });
});
