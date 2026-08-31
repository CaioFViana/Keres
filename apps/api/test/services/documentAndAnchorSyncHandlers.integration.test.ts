import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { chapters, locations, scenes, stories, users } from '../../src/db/schema';
import { SyncConflictError } from '../../src/services/entity-sync-handlers/BaseSyncEntityHandler';
import { BoardSyncHandler } from '../../src/services/entity-sync-handlers/BoardSyncHandler';
import { ChapterAnchorSyncHandler } from '../../src/services/entity-sync-handlers/ChapterAnchorSyncHandler';
import { LocationMapSyncHandler } from '../../src/services/entity-sync-handlers/LocationMapSyncHandler';
import { StoryCalendarSyncHandler } from '../../src/services/entity-sync-handlers/StoryCalendarSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;
let chapterId: string;
let sceneId: string;

const create = (entity: string, id: string, data: Record<string, unknown>) =>
  ({ type: 'create', entity, id, data }) as never;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  chapterId = newId();
  sceneId = newId();
  const locationId = newId();
  await db.insert(users).values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({ id: storyId, userId, title: 'A Queda', type: 'linear' } as never);
  await db.insert(chapters).values({ id: chapterId, storyId, name: 'Act one', index: 1 } as never);
  await db.insert(locations).values({ id: locationId, storyId, name: 'Harbor' } as never);
  await db.insert(scenes).values({
    id: sceneId, storyId, chapterId, locationId, name: 'Arrival', index: 1,
  } as never);
});

const documentCases: Array<[string, () => any, Record<string, unknown>, Record<string, unknown>]> = [
  ['Board', () => new BoardSyncHandler(), { name: 'Pins', description: null, content: { nodes: [], edges: [] } }, { name: 'Pins revised' }],
  ['LocationMap', () => new LocationMapSyncHandler(), { name: 'Continent', description: null, content: { images: [], nodes: [] } }, { name: 'Continent revised' }],
  ['StoryCalendar', () => new StoryCalendarSyncHandler(), {
    name: 'Moon calendar', isPrimary: true, description: null, extraNotes: null,
    definition: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24, daysPerWeek: 7, weekdayNames: [], unitNames: {}, months: [{ name: 'First', days: 30 }], eras: [], moons: [], seasons: [] },
  }, { name: 'Moon calendar revised' }],
];

describe('JSON-document sync handlers', () => {
  it.each(documentCases)('%s creates, version-updates, and tombstones its whole document', async (entity, build, data, changes) => {
    const handler = build();
    const id = newId();
    await handler.create(userId, storyId, create(entity, id, data));
    const created = await handler.findById(id);
    expect(created).toMatchObject({ id, storyId, version: 1, isDeleted: false });

    await handler.update(userId, storyId, {
      type: 'update', entity, id, changes: { ...changes, version: 1 },
    }, created);
    const updated = await handler.findById(id);
    expect(updated).toMatchObject({ ...changes, version: 2 });

    await handler.delete(userId, storyId, { type: 'delete', entity, id, version: 2 }, updated);
    expect(await handler.findById(id)).toMatchObject({ isDeleted: true, version: 3 });
  });

  it.each(documentCases)('%s lets only one concurrent edit based on the same version land', async (entity, build, data) => {
    const handler = build();
    const id = newId();
    await handler.create(userId, storyId, create(entity, id, data));
    const current = await handler.findById(id);
    const results = await Promise.allSettled([
      handler.update(userId, storyId, {
        type: 'update', entity, id, changes: { name: 'First edit', version: 1 },
      }, current),
      handler.update(userId, storyId, {
        type: 'update', entity, id, changes: { name: 'Second edit', version: 1 },
      }, current),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await handler.findById(id)).toMatchObject({ version: 2 });
  });
});

describe('ChapterAnchorSyncHandler', () => {
  it('only accepts live scenes and containers from its story, then preserves the base version contract', async () => {
    const handler = new ChapterAnchorSyncHandler();
    const id = newId();
    const data = {
      chapterId, order: 1, startSceneId: sceneId, startPosition: 'start', startOffset: null,
      startOffsetUnit: null, endSceneId: null, endPosition: null, endOffset: null, endOffsetUnit: null,
    };
    await handler.create(userId, storyId, create('ChapterAnchor', id, data));
    const created = await handler.findById(id);
    expect(created).toMatchObject({ storyId, chapterId, startSceneId: sceneId, version: 1 });

    await handler.update(userId, storyId, {
      type: 'update', entity: 'ChapterAnchor', id,
      changes: { endSceneId: sceneId, endPosition: 'end', version: 1 },
    } as never, created);
    const updated = await handler.findById(id);
    expect(updated).toMatchObject({ endSceneId: sceneId, endPosition: 'end', version: 2 });
    await handler.delete(userId, storyId, { type: 'delete', entity: 'ChapterAnchor', id, version: 2 } as never, updated);
    expect(await handler.findById(id)).toMatchObject({ isDeleted: true, version: 3 });
  });

  it('refuses an anchor whose referenced scene is absent or belongs to another story', async () => {
    const handler = new ChapterAnchorSyncHandler();
    await expect(handler.create(userId, storyId, create('ChapterAnchor', newId(), {
      chapterId, order: 1, startSceneId: newId(), startPosition: 'start', startOffset: null,
      startOffsetUnit: null, endSceneId: null, endPosition: null, endOffset: null, endOffsetUnit: null,
    }))).rejects.toBeInstanceOf(SyncConflictError);
  });

  it('turns the losing concurrent anchor edit into a version conflict', async () => {
    const handler = new ChapterAnchorSyncHandler();
    const id = newId();
    const data = {
      chapterId, order: 1, startSceneId: sceneId, startPosition: 'start', startOffset: null,
      startOffsetUnit: null, endSceneId: null, endPosition: null, endOffset: null, endOffsetUnit: null,
    };
    await handler.create(userId, storyId, create('ChapterAnchor', id, data));
    const current = await handler.findById(id);
    const results = await Promise.allSettled([
      handler.update(userId, storyId, {
        type: 'update', entity: 'ChapterAnchor', id, changes: { order: 2, version: 1 },
      } as never, current),
      handler.update(userId, storyId, {
        type: 'update', entity: 'ChapterAnchor', id, changes: { order: 3, version: 1 },
      } as never, current),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await handler.findById(id)).toMatchObject({ version: 2 });
  });
});
