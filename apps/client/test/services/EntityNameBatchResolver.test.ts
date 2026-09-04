/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import {
  createEntityNameBatchResolver,
  createEntitySnapshotResolver,
} from '../../src/services/EntityNameBatchResolver';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');
const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'A Queda',
    type: 'linear',
    ...base,
  });
});

afterEach(() => database.close());

describe('EntityNameBatchResolver', () => {
  it('resolves names across several entity types from a mixed batch', async () => {
    await database.db.insert(schema.characters).values([
      { id: 'mira', storyId: STORY_ID, name: 'Mira', ...base },
      { id: 'oren', storyId: STORY_ID, name: 'Oren', ...base },
    ]);
    await database.db.insert(schema.locations).values({
      id: 'tower',
      storyId: STORY_ID,
      name: 'Torre',
      ...base,
    });
    await database.db.insert(schema.galleries).values({
      id: 'portrait',
      storyId: STORY_ID,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'portrait.png',
      hash: 'hash-portrait',
      sizeBytes: 42,
      title: 'Retrato',
      ...base,
    });

    const resolver = createEntityNameBatchResolver(database.db);
    const names = await resolver.resolveMany([
      { entityType: 'Character', entityId: 'mira' },
      { entityType: 'Character', entityId: 'oren' },
      { entityType: 'Location', entityId: 'tower' },
      { entityType: 'Gallery', entityId: 'portrait' },
    ]);

    expect(names.get('Character:mira')).toBe('Mira');
    expect(names.get('Character:oren')).toBe('Oren');
    expect(names.get('Location:tower')).toBe('Torre');
    expect(names.get('Gallery:portrait')).toBe('Retrato');
  });

  it('falls back to the file name when a gallery has no title', async () => {
    await database.db.insert(schema.galleries).values({
      id: 'map',
      storyId: STORY_ID,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'mapa.png',
      hash: 'hash-map',
      sizeBytes: 42,
      title: null,
      ...base,
    });

    const resolver = createEntityNameBatchResolver(database.db);
    const names = await resolver.resolveMany([{ entityType: 'Gallery', entityId: 'map' }]);

    expect(names.get('Gallery:map')).toBe('mapa.png');
  });

  it('deduplicates repeated references and issues at most one query per entity type', async () => {
    await database.db.insert(schema.characters).values({
      id: 'mira',
      storyId: STORY_ID,
      name: 'Mira',
      ...base,
    });
    const selectSpy = jest.spyOn(database.db, 'select');

    const resolver = createEntityNameBatchResolver(database.db);
    const names = await resolver.resolveMany([
      { entityType: 'Character', entityId: 'mira' },
      { entityType: 'Character', entityId: 'mira' },
      { entityType: 'Character', entityId: 'mira' },
    ]);

    expect(names.get('Character:mira')).toBe('Mira');
    expect(selectSpy).toHaveBeenCalledTimes(1);
    selectSpy.mockRestore();
  });

  it('ignores references to entity types it has no table for', async () => {
    const resolver = createEntityNameBatchResolver(database.db);
    const names = await resolver.resolveMany([{ entityType: 'NotAnEntity', entityId: 'x' }]);

    expect(names.size).toBe(0);
  });

  it('leaves a missing entity out of the result instead of throwing', async () => {
    const resolver = createEntityNameBatchResolver(database.db);
    const names = await resolver.resolveMany([{ entityType: 'Character', entityId: 'ghost' }]);

    expect(names.has('Character:ghost')).toBe(false);
  });

  it('can exclude soft-deleted entities for live content lookups', async () => {
    await database.db.insert(schema.characters).values({
      id: 'deleted-character',
      storyId: STORY_ID,
      name: 'Memória',
      ...base,
      isDeleted: true,
    });

    const names = await createEntityNameBatchResolver(database.db).resolveMany(
      [{ entityType: 'Character', entityId: 'deleted-character' }],
      { includeDeleted: false },
    );

    expect(names.has('Character:deleted-character')).toBe(false);
  });
});

/**
 * Unlike `createEntityNameBatchResolver` (a name column only), this resolves the whole local
 * row - used to fill in what a `deleted_on_server` conflict's `localValues`/`serverValues`
 * leave missing (see `ConflictSummaryService.ts`'s `mergedValuesOf`).
 */
describe('createEntitySnapshotResolver', () => {
  it('resolves the full local row of an entity, not just its name column', async () => {
    await database.db.insert(schema.characters).values({
      id: 'mira',
      storyId: STORY_ID,
      name: 'Mira',
      motivation: 'Proteger a irmã',
      ...base,
    });

    const resolver = createEntitySnapshotResolver(database.db);
    const snapshots = await resolver.resolveMany([{ entityType: 'Character', entityId: 'mira' }]);

    expect(snapshots.get('Character:mira')).toMatchObject({
      name: 'Mira',
      motivation: 'Proteger a irmã',
    });
  });

  it('resolves a CharacterRelation snapshot using the same field names as the sync payload', async () => {
    await database.db.insert(schema.characters).values([
      { id: 'mira', storyId: STORY_ID, name: 'Mira', ...base },
      { id: 'oren', storyId: STORY_ID, name: 'Oren', ...base },
    ]);
    await database.db.insert(schema.characterRelations).values({
      id: 'relation-1',
      storyId: STORY_ID,
      character1Id: 'mira',
      character2Id: 'oren',
      relationType: 'allies',
      ...base,
    });

    const resolver = createEntitySnapshotResolver(database.db);
    const snapshots = await resolver.resolveMany([
      { entityType: 'CharacterRelation', entityId: 'relation-1' },
    ]);

    expect(snapshots.get('CharacterRelation:relation-1')).toMatchObject({
      character1Id: 'mira',
      character2Id: 'oren',
      relationType: 'allies',
    });
  });

  /**
   * The snapshot's whole point: an entity deleted on the server but not locally (the
   * remote deletion is deliberately not applied, see `reconcileRemoteUpdate`) still has
   * `isDeleted: false` in the local table - the resolver does not filter by that, so it still finds the
   * row with the real name.
   */
  it('finds an entity regardless of its isDeleted flag', async () => {
    await database.db.insert(schema.characters).values({
      id: 'mira',
      storyId: STORY_ID,
      name: 'Mira',
      ...base,
      isDeleted: true,
    });

    const resolver = createEntitySnapshotResolver(database.db);
    const snapshots = await resolver.resolveMany([{ entityType: 'Character', entityId: 'mira' }]);

    expect(snapshots.get('Character:mira')).toMatchObject({ name: 'Mira', isDeleted: true });
  });

  it('leaves a missing entity out of the result instead of throwing', async () => {
    const resolver = createEntitySnapshotResolver(database.db);
    const snapshots = await resolver.resolveMany([{ entityType: 'Character', entityId: 'ghost' }]);

    expect(snapshots.has('Character:ghost')).toBe(false);
  });
});
