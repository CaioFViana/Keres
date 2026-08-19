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
