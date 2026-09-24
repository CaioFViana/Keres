/**
 * @jest-environment node
 */
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { CharacterRelationClientSyncHandler } from '../../src/services/entity-sync-handlers/CharacterRelationClientSyncHandler';
import { GalleryClientSyncHandler } from '../../src/services/entity-sync-handlers/GalleryClientSyncHandler';
import { LocationRelationClientSyncHandler } from '../../src/services/entity-sync-handlers/LocationRelationClientSyncHandler';
import { StorySchemaFieldClientSyncHandler } from '../../src/services/entity-sync-handlers/StorySchemaFieldClientSyncHandler';
import { mediaFileService } from '../../src/services/MediaFileService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = 'story-sync-specialties';
const EARLY = '2026-08-10T12:00:00.000Z';
const LATE = '2026-08-11T12:00:00.000Z';

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
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('CharacterRelationClientSyncHandler', () => {
  const relation = (id: string, updatedAt = EARLY) => ({
    id,
    storyId: STORY_ID,
    character1Id: 'character-a',
    character2Id: 'character-b',
    relationType: 'ally',
    createdAt: EARLY,
    updatedAt,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  });

  it('maps the server character fields and lets a newer relation replace its duplicate', async () => {
    const handler = new CharacterRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('CharacterRelation', 'old', relation('old')));

    await handler.applyCreate(
      STORY_ID,
      createUpdate('CharacterRelation', 'new', relation('new', LATE)),
    );

    const rows = await database.db.select().from(schema.characterRelations).all();
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'new',
          character1Id: 'character-a',
          character2Id: 'character-b',
        }),
        expect.objectContaining({ id: 'old', isDeleted: true, version: 2 }),
      ]),
    );
  });

  it('discards a stale duplicate even when the character order is reversed', async () => {
    const handler = new CharacterRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('CharacterRelation', 'kept', relation('kept', LATE)),
    );

    await handler.applyCreate(
      STORY_ID,
      createUpdate('CharacterRelation', 'stale', relation('stale')),
    );

    const rows = await database.db.select().from(schema.characterRelations).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'kept', isDeleted: false });
  });

  it('lets a newer update replace a duplicate pair and maps the server character ids', async () => {
    const handler = new CharacterRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('CharacterRelation', 'old', relation('old')));
    await handler.applyCreate(
      STORY_ID,
      createUpdate('CharacterRelation', 'moving', {
        ...relation('moving'),
        character1Id: 'character-c',
        character2Id: 'character-d',
      }),
    );

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('CharacterRelation', 'moving', {
        character1Id: 'character-a',
        character2Id: 'character-b',
        updatedAt: LATE,
      }),
    );

    expect(await handler.getById('old')).toEqual(expect.objectContaining({ isDeleted: true }));
    expect(await handler.getById('moving')).toEqual(
      expect.objectContaining({
        character1Id: 'character-a',
        character2Id: 'character-b',
        isDeleted: false,
      }),
    );
  });

  it('keeps the newer pair when an older update would collide and tombstones on delete', async () => {
    const handler = new CharacterRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('CharacterRelation', 'kept', relation('kept', LATE)),
    );
    await handler.applyCreate(
      STORY_ID,
      createUpdate('CharacterRelation', 'moving', {
        ...relation('moving'),
        character1Id: 'character-c',
        character2Id: 'character-d',
      }),
    );

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('CharacterRelation', 'moving', {
        character1Id: 'character-a',
        character2Id: 'character-b',
        updatedAt: EARLY,
      }),
    );
    await handler.applyDelete(STORY_ID, deleteUpdate('CharacterRelation', 'moving'));

    expect(await handler.getById('kept')).toEqual(expect.objectContaining({ isDeleted: false }));
    expect(await handler.getById('moving')).toEqual(
      expect.objectContaining({
        character1Id: 'character-c',
        character2Id: 'character-d',
        isDeleted: true,
      }),
    );
  });

  it('refuses relation work before a database is set', async () => {
    const handler = new CharacterRelationClientSyncHandler();

    await expect(
      handler.applyCreate(STORY_ID, createUpdate('CharacterRelation', 'r-1', {})),
    ).rejects.toThrow(/Drizzle client \(db\).*not set/);
  });

  it('ignores relation operations addressed to another entity type', async () => {
    const handler = new CharacterRelationClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(STORY_ID, createUpdate('OutraEntidade', 'r-1', {}));
    await handler.applyUpdate(STORY_ID, updateUpdate('OutraEntidade', 'r-1', {}));
    await handler.applyDelete(STORY_ID, deleteUpdate('OutraEntidade', 'r-1'));

    expect(await database.db.select().from(schema.characterRelations).all()).toEqual([]);
  });

  it('refuses relation operations with no id or no changes', async () => {
    const handler = new CharacterRelationClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(STORY_ID, {
      type: 'create',
      entity: 'CharacterRelation',
      data: {},
    } as never);
    await handler.applyUpdate(STORY_ID, {
      type: 'update',
      entity: 'CharacterRelation',
      changes: {},
    } as never);
    await handler.applyUpdate(STORY_ID, {
      type: 'update',
      entity: 'CharacterRelation',
      id: 'r-1',
    } as never);
    await handler.applyDelete(STORY_ID, { type: 'delete', entity: 'CharacterRelation' } as never);

    expect(await database.db.select().from(schema.characterRelations).all()).toEqual([]);
  });

  it('stores a tombstone relation with its deletion date revived', async () => {
    const handler = new CharacterRelationClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(
      STORY_ID,
      createUpdate('CharacterRelation', 'tomb', {
        ...relation('tomb'),
        isDeleted: true,
        deletedAt: EARLY,
      }),
    );

    const row = await handler.getById('tomb');
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect((row?.deletedAt as Date).toISOString()).toBe(new Date(EARLY).toISOString());
  });

  it('skips an update for a relation that is not here', async () => {
    const handler = new CharacterRelationClientSyncHandler();
    handler.setDb(database.db);

    await expect(
      handler.applyUpdate(
        STORY_ID,
        updateUpdate('CharacterRelation', 'nao-existe', { relationType: 'rival' }),
      ),
    ).resolves.toBeUndefined();

    expect(await database.db.select().from(schema.characterRelations).all()).toEqual([]);
  });

  /**
   * The ordinary update: no duplicate in the way, the pair untouched. The effective pair comes
   * from the stored row, and the ISO dates in the change are revived.
   */
  it('applies a duplicate-free update against the stored pair', async () => {
    const handler = new CharacterRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('CharacterRelation', 'r-1', relation('r-1')));

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('CharacterRelation', 'r-1', {
        relationType: 'rival',
        createdAt: EARLY,
        deletedAt: EARLY,
      }),
    );

    const row = await handler.getById('r-1');
    expect(row).toMatchObject({
      relationType: 'rival',
      character1Id: 'character-a',
      character2Id: 'character-b',
    });
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it('wins a duplicate update by recency when the change carries no timestamp', async () => {
    const handler = new CharacterRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('CharacterRelation', 'old', relation('old')));
    await handler.applyCreate(
      STORY_ID,
      createUpdate('CharacterRelation', 'moving', {
        ...relation('moving'),
        character1Id: 'character-c',
        character2Id: 'character-d',
      }),
    );

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('CharacterRelation', 'moving', {
        character1Id: 'character-a',
        character2Id: 'character-b',
      }),
    );

    expect(await handler.getById('old')).toEqual(expect.objectContaining({ isDeleted: true }));
    expect(await handler.getById('moving')).toEqual(
      expect.objectContaining({
        character1Id: 'character-a',
        character2Id: 'character-b',
        isDeleted: false,
      }),
    );
  });
});

describe('LocationRelationClientSyncHandler', () => {
  const relation = (
    id: string,
    relationType: string,
    locationAId: string,
    locationBId: string,
  ) => ({
    id,
    storyId: STORY_ID,
    relationType,
    locationAId,
    locationBId,
    createdAt: EARLY,
    updatedAt: EARLY,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  });

  it('treats connected_to as an unordered edge during a pull', async () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'kept', relation('kept', 'connected_to', 'a', 'b')),
    );
    await handler.applyCreate(
      STORY_ID,
      createUpdate(
        'LocationRelation',
        'duplicate',
        relation('duplicate', 'connected_to', 'b', 'a'),
      ),
    );

    expect(await database.db.select().from(schema.locationRelations).all()).toHaveLength(1);
  });

  it('keeps only one live parent for a contains edge', async () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'first', relation('first', 'contains', 'parent-a', 'child')),
    );
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'second', {
        ...relation('second', 'contains', 'parent-b', 'child'),
        updatedAt: LATE,
      }),
    );

    const rows = await database.db.select().from(schema.locationRelations).all();
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'first', isDeleted: true }),
        expect.objectContaining({ id: 'second', isDeleted: false }),
      ]),
    );
  });

  it('refuses location-relation work before a database is set', async () => {
    const handler = new LocationRelationClientSyncHandler();

    await expect(
      handler.applyCreate(STORY_ID, createUpdate('LocationRelation', 'r-1', {})),
    ).rejects.toThrow(/Drizzle client \(db\).*not set/);
  });

  it('ignores a create addressed to another entity type', async () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(STORY_ID, createUpdate('OutraEntidade', 'r-1', {}));

    expect(await database.db.select().from(schema.locationRelations).all()).toEqual([]);
  });

  it('refuses an update with no id or no changes', async () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyUpdate(STORY_ID, updateUpdate('OutraEntidade', 'r-1', {}));
    await handler.applyUpdate(STORY_ID, {
      type: 'update',
      entity: 'LocationRelation',
      changes: {},
    } as never);
    await handler.applyUpdate(STORY_ID, {
      type: 'update',
      entity: 'LocationRelation',
      id: 'r-1',
    } as never);

    expect(await database.db.select().from(schema.locationRelations).all()).toEqual([]);
  });

  it('wins a duplicate create by recency when it carries no timestamp', async () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'old', relation('old', 'connected_to', 'a', 'b')),
    );
    const { updatedAt: _dropped, ...bare } = relation('new', 'connected_to', 'b', 'a');

    await handler.applyCreate(STORY_ID, createUpdate('LocationRelation', 'new', bare));

    const rows = await database.db.select().from(schema.locationRelations).all();
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'old', isDeleted: true }),
        expect.objectContaining({ id: 'new', isDeleted: false }),
      ]),
    );
  });

  it('stores a tombstone edge with its deletion date revived', async () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'tomb', {
        ...relation('tomb', 'connected_to', 'a', 'b'),
        isDeleted: true,
        deletedAt: EARLY,
      }),
    );

    const row = await handler.getById('tomb');
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect((row?.deletedAt as Date).toISOString()).toBe(new Date(EARLY).toISOString());
  });

  /**
   * The ordinary update: no conflict, the endpoints untouched, the operation's own timestamp
   * deciding `updatedAt`. The endpoints come from the stored row, and the ISO dates revive.
   */
  it('applies a conflict-free update stamped with the operation time', async () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'r-1', relation('r-1', 'connected_to', 'a', 'b')),
    );

    await handler.applyUpdate(STORY_ID, {
      ...updateUpdate('LocationRelation', 'r-1', {
        relationType: 'connected_to',
        createdAt: EARLY,
        deletedAt: EARLY,
      }),
      operationTime: LATE,
    });

    const row = await handler.getById('r-1');
    expect(row?.updatedAt).toBeInstanceOf(Date);
    expect((row?.updatedAt as Date).toISOString()).toBe(new Date(LATE).toISOString());
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it('stamps a conflict-free update without dates or operation time with now', async () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'r-1', relation('r-1', 'connected_to', 'a', 'b')),
    );
    // The timestamp column only keeps whole seconds, so the comparison drops the
    // milliseconds - otherwise the test flakes whenever "now" has any.
    const before = Math.floor(Date.now() / 1000) * 1000;

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('LocationRelation', 'r-1', { relationType: 'connected_to' }),
    );

    const row = await handler.getById('r-1');
    expect((row?.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect(row?.createdAt).toBeInstanceOf(Date);
  });

  it('wins a conflicting update by recency when the change carries no timestamp', async () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'old', relation('old', 'connected_to', 'a', 'b')),
    );
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'moving', relation('moving', 'connected_to', 'c', 'd')),
    );

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('LocationRelation', 'moving', { locationAId: 'a', locationBId: 'b' }),
    );

    expect(await handler.getById('old')).toEqual(expect.objectContaining({ isDeleted: true }));
    expect(await handler.getById('moving')).toEqual(
      expect.objectContaining({ locationAId: 'a', locationBId: 'b', isDeleted: false }),
    );
  });

  it('soft-deletes the edge, keeping the row so the tombstone survives', async () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'r-1', relation('r-1', 'connected_to', 'a', 'b')),
    );

    await handler.applyDelete(STORY_ID, deleteUpdate('LocationRelation', 'r-1'));

    const row = await handler.getById('r-1');
    expect(row).toMatchObject({ isDeleted: true });
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });
});

describe('GalleryClientSyncHandler', () => {
  const media = (id: string, hash = 'hash-one') => ({
    id,
    storyId: STORY_ID,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'map.png',
    hash,
    sizeBytes: 99,
    title: null,
    isFavorite: false,
    extraNotes: null,
    createdAt: EARLY,
    updatedAt: EARLY,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  });

  it('treats a remote link as complete because it has no bytes to download', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('Gallery', 'gallery-link', {
        ...media('gallery-link'),
        mediaType: 'link',
        mimeType: 'text/uri-list',
        fileName: 'notes.example',
        sourceUrl: 'https://notes.example/lore',
      }),
    );

    expect(await handler.getById('gallery-link')).toMatchObject({
      mediaType: 'link',
      sourceUrl: 'https://notes.example/lore',
      localPath: null,
      uploadState: 'uploaded',
      downloadState: 'downloaded',
    });
  });

  it('never accepts device-local transfer state from the remote payload', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('Gallery', 'gallery-1', {
        ...media('gallery-1'),
        localPath: 'file:///other-device.png',
        uploadState: 'pending',
        downloadState: 'downloaded',
      }),
    );

    const row = await handler.getById('gallery-1');
    expect(row).toMatchObject({
      localPath: null,
      uploadState: 'uploaded',
      downloadState: 'pending',
    });
  });

  it('invalidates downloaded bytes when a remote hash changes', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('Gallery', 'gallery-1', media('gallery-1')));
    await database.db
      .update(schema.galleries)
      .set({ localPath: 'desktop-media:media/story/hash-one.png', downloadState: 'downloaded' })
      .where(eq(schema.galleries.id, 'gallery-1'));

    await handler.applyUpdate(STORY_ID, updateUpdate('Gallery', 'gallery-1', { hash: 'hash-two' }));

    expect(await handler.getById('gallery-1')).toMatchObject({
      hash: 'hash-two',
      localPath: null,
      downloadState: 'pending',
      uploadState: 'uploaded',
    });
  });

  it('refuses gallery work before a database is set', async () => {
    const handler = new GalleryClientSyncHandler();

    await expect(
      handler.applyCreate(STORY_ID, createUpdate('Gallery', 'gallery-1', {})),
    ).rejects.toThrow(/Drizzle client \(db\).*not set/);
  });

  it('ignores gallery operations addressed to another entity type', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(STORY_ID, createUpdate('OutraEntidade', 'gallery-1', {}));
    await handler.applyUpdate(STORY_ID, updateUpdate('OutraEntidade', 'gallery-1', {}));
    await handler.applyDelete(STORY_ID, deleteUpdate('OutraEntidade', 'gallery-1'));

    expect(await database.db.select().from(schema.galleries).all()).toEqual([]);
  });

  it('refuses gallery operations with no id or no changes', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(STORY_ID, { type: 'create', entity: 'Gallery', data: {} } as never);
    await handler.applyUpdate(STORY_ID, {
      type: 'update',
      entity: 'Gallery',
      changes: {},
    } as never);
    await handler.applyUpdate(STORY_ID, { type: 'update', entity: 'Gallery', id: 'g-1' } as never);
    await handler.applyDelete(STORY_ID, { type: 'delete', entity: 'Gallery' } as never);

    expect(await database.db.select().from(schema.galleries).all()).toEqual([]);
  });

  it('stores a tombstone gallery row with its deletion date revived', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(
      STORY_ID,
      createUpdate('Gallery', 'gallery-9', {
        ...media('gallery-9'),
        isDeleted: true,
        deletedAt: EARLY,
      }),
    );

    const row = await handler.getById('gallery-9');
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect((row?.deletedAt as Date).toISOString()).toBe(new Date(EARLY).toISOString());
  });

  it('revives the ISO dates a gallery change carries', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('Gallery', 'gallery-1', media('gallery-1')));

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('Gallery', 'gallery-1', {
        title: 'New title',
        createdAt: EARLY,
        deletedAt: EARLY,
      }),
    );

    const row = await handler.getById('gallery-1');
    expect(row).toMatchObject({ title: 'New title' });
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  /**
   * A metadata-only change (a retitle, say) must not demote bytes that still match: without this
   * every rename would wipe the local file and force a useless re-download.
   */
  it('keeps downloaded bytes when a change carries no new hash', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('Gallery', 'gallery-1', media('gallery-1')));
    await database.db
      .update(schema.galleries)
      .set({ localPath: 'desktop-media:media/story/hash-one.png', downloadState: 'downloaded' })
      .where(eq(schema.galleries.id, 'gallery-1'));

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('Gallery', 'gallery-1', { title: 'Retitled' }),
    );

    expect(await handler.getById('gallery-1')).toMatchObject({
      title: 'Retitled',
      localPath: 'desktop-media:media/story/hash-one.png',
      downloadState: 'downloaded',
    });
  });

  it('completes a link immediately even when its hash changed', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('Gallery', 'gallery-link', { ...media('gallery-link'), mediaType: 'link' }),
    );

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('Gallery', 'gallery-link', { hash: 'hash-two' }),
    );

    expect(await handler.getById('gallery-link')).toMatchObject({
      hash: 'hash-two',
      localPath: null,
      downloadState: 'downloaded',
    });
  });

  it('clears the stale thumbnail and deletes files detached by a remote hash swap', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);
    const deleteLocal = jest.spyOn(mediaFileService, 'deleteLocal').mockImplementation(() => {});
    await handler.applyCreate(STORY_ID, createUpdate('Gallery', 'gallery-1', media('gallery-1')));
    await database.db
      .update(schema.galleries)
      .set({
        localPath: 'desktop-media:media/story/hash-one.png',
        thumbnailPath: 'desktop-media:media/story/hash-one_thumb.jpg',
        downloadState: 'downloaded',
      })
      .where(eq(schema.galleries.id, 'gallery-1'));

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('Gallery', 'gallery-1', { hash: 'hash-two', version: 1 }),
    );

    // The old frame belongs to the old bytes: keeping it would show the wrong thumbnail with no
    // regeneration ever triggered.
    expect(await handler.getById('gallery-1')).toMatchObject({
      hash: 'hash-two',
      localPath: null,
      thumbnailPath: null,
      downloadState: 'pending',
    });
    expect(deleteLocal).toHaveBeenCalledWith('desktop-media:media/story/hash-one.png');
    expect(deleteLocal).toHaveBeenCalledWith('desktop-media:media/story/hash-one_thumb.jpg');
  });

  it('keeps an abandoned file that another live medium still shares', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);
    const deleteLocal = jest.spyOn(mediaFileService, 'deleteLocal').mockImplementation(() => {});
    await handler.applyCreate(STORY_ID, createUpdate('Gallery', 'gallery-1', media('gallery-1')));
    await handler.applyCreate(STORY_ID, createUpdate('Gallery', 'gallery-2', media('gallery-2')));
    await database.db
      .update(schema.galleries)
      .set({ localPath: 'shared.png', downloadState: 'downloaded' })
      .where(eq(schema.galleries.id, 'gallery-2'));

    await database.db
      .update(schema.galleries)
      .set({ localPath: 'shared.png', downloadState: 'downloaded' })
      .where(eq(schema.galleries.id, 'gallery-1'));
    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('Gallery', 'gallery-1', { hash: 'hash-two', version: 1 }),
    );

    expect(deleteLocal).not.toHaveBeenCalledWith('shared.png');
  });

  it('soft-deletes the gallery row, keeping it so the tombstone survives', async () => {
    const handler = new GalleryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('Gallery', 'gallery-1', media('gallery-1')));

    await handler.applyDelete(STORY_ID, deleteUpdate('Gallery', 'gallery-1'));

    const row = await handler.getById('gallery-1');
    expect(row).toMatchObject({ isDeleted: true });
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });
});

describe('StorySchemaFieldClientSyncHandler', () => {
  const field = (id: string) => ({
    id,
    storyId: STORY_ID,
    entityType: 'Character',
    name: 'Honra',
    key: 'honor',
    description: null,
    type: 'number',
    targetEntityType: null,
    isRequired: false,
    defaultValue: null,
    order: 0,
    createdAt: EARLY,
    updatedAt: EARLY,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  });

  it('rejects remote changes that would reinterpret existing attribute values', async () => {
    const handler = new StorySchemaFieldClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('StorySchemaField', 'field-1', field('field-1')),
    );

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('StorySchemaField', 'field-1', {
        name: 'Prestígio',
        key: 'prestige',
        type: 'text',
        entityType: 'Location',
        targetEntityType: 'Character',
      }),
    );

    expect(await handler.getById('field-1')).toMatchObject({
      name: 'Prestígio',
      key: 'honor',
      type: 'number',
      entityType: 'Character',
      targetEntityType: null,
    });
  });
});
