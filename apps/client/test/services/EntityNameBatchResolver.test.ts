/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createEntityNameBatchResolver } from '../../src/services/EntityNameBatchResolver';
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
});
