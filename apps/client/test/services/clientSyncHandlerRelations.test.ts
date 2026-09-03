/** @jest-environment node */
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import * as schema from '../../src/db/schema';
import { CommentClientSyncHandler } from '../../src/services/entity-sync-handlers/CommentClientSyncHandler';
import { FavoriteClientSyncHandler } from '../../src/services/entity-sync-handlers/FavoriteClientSyncHandler';
import { GalleryRelationClientSyncHandler } from '../../src/services/entity-sync-handlers/GalleryRelationClientSyncHandler';
import { LocationRelationClientSyncHandler } from '../../src/services/entity-sync-handlers/LocationRelationClientSyncHandler';
import { SeeAlsoRelationClientSyncHandler } from '../../src/services/entity-sync-handlers/SeeAlsoRelationClientSyncHandler';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const CREATED_AT = '2026-08-10T12:00:00.000Z';
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

describe('collaboration sync handlers', () => {
  it('imports, updates and tombstones a comment while remaining idempotent', async () => {
    const handler = new CommentClientSyncHandler();
    handler.setDb(database.db);
    const comment = {
      id: 'comment-1',
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: 'character-1',
      fieldKey: 'name',
      authorUserId: 'author-1',
      commentText: 'Revisar este nome',
      criticality: 2,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };

    await handler.applyCreate(STORY_ID, createUpdate('Comment', 'comment-1', comment));
    await handler.applyCreate(STORY_ID, createUpdate('Comment', 'comment-1', comment));
    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('Comment', 'comment-1', { commentText: 'Nome aprovado' }),
    );
    await handler.applyDelete(STORY_ID, deleteUpdate('Comment', 'comment-1'));

    expect(await handler.getById('comment-1')).toEqual(
      expect.objectContaining({ commentText: 'Nome aprovado', isDeleted: true }),
    );
  });

  it('syncs a user favorite idempotently without altering a separate favorite', async () => {
    const handler = new FavoriteClientSyncHandler();
    handler.setDb(database.db);
    const favorite = {
      id: 'favorite-1',
      storyId: STORY_ID,
      entityId: 'character-1',
      entityType: 'Character',
      userId: 'reader-1',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };

    await handler.applyCreate(STORY_ID, createUpdate('Favorite', 'favorite-1', favorite));
    await handler.applyCreate(STORY_ID, createUpdate('Favorite', 'favorite-1', favorite));
    await database.db.insert(schema.favorites).values({
      ...favorite,
      id: 'favorite-2',
      entityId: 'character-2',
      createdAt: new Date(CREATED_AT),
      updatedAt: new Date(CREATED_AT),
    });
    await handler.applyDelete(STORY_ID, deleteUpdate('Favorite', 'favorite-1'));

    expect(await handler.getById('favorite-1')).toEqual(
      expect.objectContaining({ isDeleted: true }),
    );
    expect(await handler.getById('favorite-2')).toEqual(
      expect.objectContaining({ isDeleted: false }),
    );
  });

  it('uses the story context and unique relation key to make see-also pulls repeatable', async () => {
    const handler = new SeeAlsoRelationClientSyncHandler();
    handler.setDb(database.db);
    const relation = {
      id: 'see-1',
      storyId: 'wrong-story',
      entityAType: 'Character',
      entityAId: 'character-1',
      entityBType: 'Location',
      entityBId: 'location-1',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };

    await handler.applyCreate(STORY_ID, createUpdate('SeeAlsoRelation', 'see-1', relation));
    await handler.applyCreate(
      STORY_ID,
      createUpdate('SeeAlsoRelation', 'see-2', { ...relation, id: 'see-2' }),
    );
    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('SeeAlsoRelation', 'see-1', { entityBId: 'location-2' }),
    );

    expect(await database.db.select().from(schema.seeAlsoRelations).all()).toEqual([
      expect.objectContaining({ id: 'see-1', storyId: STORY_ID, entityBId: 'location-2' }),
    ]);
  });

  it('applies gallery ownership changes and ignores another entity type', async () => {
    const handler = new GalleryRelationClientSyncHandler();
    handler.setDb(database.db);
    const relation = {
      id: 'gallery-relation-1',
      storyId: STORY_ID,
      galleryId: 'gallery-1',
      ownerId: 'character-1',
      ownerType: 'Character',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };

    await handler.applyCreate(STORY_ID, createUpdate('GalleryRelation', relation.id, relation));
    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('GalleryRelation', relation.id, { ownerId: 'character-2' }),
    );
    await handler.applyDelete(STORY_ID, deleteUpdate('OutraEntidade', relation.id));

    expect(await handler.getById(relation.id)).toEqual(
      expect.objectContaining({ ownerId: 'character-2', isDeleted: false }),
    );
  });
});

describe('LocationRelationClientSyncHandler duplicate reconciliation', () => {
  const relation = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    storyId: STORY_ID,
    locationAId: 'location-a',
    locationBId: 'location-b',
    relationType: 'connected_to',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  });

  const withHandler = () => {
    const handler = new LocationRelationClientSyncHandler();
    handler.setDb(database.db);
    return handler;
  };

  it('keeps the newer local connection when a duplicate arrives from the server', async () => {
    const handler = withHandler();
    await handler.applyCreate(
      STORY_ID,
      createUpdate(
        'LocationRelation',
        'local',
        relation('local', { updatedAt: '2026-08-11T12:00:00.000Z' }),
      ),
    );

    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'older-remote', relation('older-remote')),
    );

    expect(await database.db.select().from(schema.locationRelations).all()).toEqual([
      expect.objectContaining({ id: 'local', isDeleted: false }),
    ]);
  });

  it('replaces an older local connection when the incoming duplicate is newer', async () => {
    const handler = withHandler();
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'local', relation('local')),
    );

    await handler.applyCreate(
      STORY_ID,
      createUpdate(
        'LocationRelation',
        'newer-remote',
        relation('newer-remote', { updatedAt: '2026-08-11T12:00:00.000Z' }),
      ),
    );

    const byId = new Map(
      (await database.db.select().from(schema.locationRelations).all()).map((row) => [row.id, row]),
    );
    expect(byId.get('local')).toMatchObject({ isDeleted: true, version: 2 });
    expect(byId.get('newer-remote')).toMatchObject({ isDeleted: false });
  });

  it('treats a child with another contains parent as the same conflict class', async () => {
    const handler = withHandler();
    await handler.applyCreate(
      STORY_ID,
      createUpdate(
        'LocationRelation',
        'old-parent',
        relation('old-parent', {
          relationType: 'contains',
          locationAId: 'parent-a',
          locationBId: 'child',
        }),
      ),
    );

    await handler.applyCreate(
      STORY_ID,
      createUpdate(
        'LocationRelation',
        'new-parent',
        relation('new-parent', {
          relationType: 'contains',
          locationAId: 'parent-b',
          locationBId: 'child',
        }),
      ),
    );

    expect(await database.db.select().from(schema.locationRelations).all()).toHaveLength(1);
  });

  it('does not overwrite a local relation when an older update would make it duplicate', async () => {
    const handler = withHandler();
    await handler.applyCreate(
      STORY_ID,
      createUpdate(
        'LocationRelation',
        'target',
        relation('target', { locationAId: 'location-c', locationBId: 'location-d' }),
      ),
    );
    await handler.applyCreate(
      STORY_ID,
      createUpdate(
        'LocationRelation',
        'existing',
        relation('existing', { updatedAt: '2026-08-11T12:00:00.000Z' }),
      ),
    );

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('LocationRelation', 'target', {
        locationAId: 'location-a',
        locationBId: 'location-b',
        updatedAt: CREATED_AT,
      }),
    );

    expect(await handler.getById('target')).toEqual(
      expect.objectContaining({ locationAId: 'location-c', locationBId: 'location-d' }),
    );
  });

  it('ignores malformed, misaddressed, and missing local operations without mutating a relation', async () => {
    const handler = withHandler();
    await handler.applyCreate(
      STORY_ID,
      createUpdate('LocationRelation', 'relation-1', relation('relation-1')),
    );

    await handler.applyCreate(STORY_ID, {
      type: 'create',
      entity: 'LocationRelation',
      data: relation('missing-id'),
    } as unknown as CreateStoryUpdate);
    await handler.applyUpdate(STORY_ID, {
      type: 'update',
      entity: 'LocationRelation',
      id: 'relation-1',
    } as UpdateStoryUpdate);
    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('LocationRelation', 'unknown', { relationType: 'contains' }),
    );
    await handler.applyDelete(STORY_ID, {
      type: 'delete',
      entity: 'LocationRelation',
    } as DeleteStoryUpdate);
    await handler.applyDelete(STORY_ID, deleteUpdate('OtherEntity', 'relation-1'));

    expect(await handler.getById('relation-1')).toEqual(
      expect.objectContaining({ isDeleted: false }),
    );
    expect(await database.db.select().from(schema.locationRelations).all()).toHaveLength(1);
  });
});
