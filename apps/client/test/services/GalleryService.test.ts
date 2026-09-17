/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

it('finds gallery work that is pending transfer without including deleted media', async () => {
  await database.db.insert(schema.galleries).values([
    {
      id: 'upload',
      storyId: TEST_STORY_ID,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'upload.png',
      hash: 'upload-hash',
      sizeBytes: 10,
      uploadState: 'pending',
      downloadState: 'downloaded',
      ...entityBase,
    },
    {
      id: 'download',
      storyId: TEST_STORY_ID,
      mediaType: 'audio',
      mimeType: 'audio/mpeg',
      fileName: 'download.mp3',
      hash: 'download-hash',
      sizeBytes: 20,
      uploadState: 'uploaded',
      downloadState: 'failed',
      ...entityBase,
    },
    {
      id: 'deleted',
      storyId: TEST_STORY_ID,
      mediaType: 'video',
      mimeType: 'video/mp4',
      fileName: 'deleted.mp4',
      hash: 'deleted-hash',
      sizeBytes: 30,
      uploadState: 'failed',
      downloadState: 'pending',
      ...entityBase,
      isDeleted: true,
    },
  ]);

  const service = createGalleryService(database.db);
  expect((await service.getPendingUploads(TEST_STORY_ID)).map(({ id }) => id)).toEqual(['upload']);
  expect((await service.getPendingDownloads(TEST_STORY_ID)).map(({ id }) => id)).toEqual([
    'download',
  ]);
});

it('filters gallery media, retrieves it through a live owner relation, and ignores deleted links', async () => {
  await database.db.insert(schema.galleries).values([
    {
      id: 'map',
      storyId: TEST_STORY_ID,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'city-map.png',
      hash: 'map-hash',
      sizeBytes: 10,
      title: 'Mapa da cidade',
      isFavorite: true,
      ...entityBase,
    },
    {
      id: 'song',
      storyId: TEST_STORY_ID,
      mediaType: 'audio',
      mimeType: 'audio/mpeg',
      fileName: 'theme.mp3',
      hash: 'song-hash',
      sizeBytes: 20,
      title: 'Tema',
      isFavorite: false,
      ...entityBase,
    },
  ]);
  await database.db.insert(schema.galleryRelations).values([
    {
      id: 'map-owner',
      storyId: TEST_STORY_ID,
      galleryId: 'map',
      ownerId: 'city',
      ownerType: 'Location',
      ...entityBase,
    },
    {
      id: 'song-owner-deleted',
      storyId: TEST_STORY_ID,
      galleryId: 'song',
      ownerId: 'city',
      ownerType: 'Location',
      ...entityBase,
      isDeleted: true,
    },
  ]);

  const service = createGalleryService(database.db);
  expect(
    (
      await service.getGalleriesByStoryId(TEST_STORY_ID, {
        searchTerm: 'CIDADE',
        mediaTypes: ['image'],
        favoriteFilterState: 'favorite',
      })
    ).map(({ id }) => id),
  ).toEqual(['map']);
  expect(
    (await service.getGalleriesForOwner(TEST_STORY_ID, 'city', 'Location')).map(({ id }) => id),
  ).toEqual(['map']);
});

it('marks a newly created link as already transferred because there are no bytes to send', async () => {
  const service = createGalleryService(database.db);
  const created = await service.createGallery('local-user', {
    storyId: TEST_STORY_ID,
    mediaType: 'link',
    mimeType: 'text/uri-list',
    fileName: 'notes.example',
    hash: 'a'.repeat(32),
    sizeBytes: 0,
    sourceUrl: 'https://notes.example/lore',
    localPath: null,
  });
  expect(created).toEqual(
    expect.objectContaining({
      mediaType: 'link',
      sourceUrl: 'https://notes.example/lore',
      uploadState: 'uploaded',
      downloadState: 'downloaded',
      localPath: null,
    }),
  );
  expect((await service.getPendingUploads(TEST_STORY_ID)).map(({ id }) => id)).not.toContain(
    created.id,
  );
});

it('writes metadata changes without treating local transfer state as a synced entity update', async () => {
  const service = createGalleryService(database.db);
  const created = await service.createGallery('local-user', {
    storyId: TEST_STORY_ID,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'before.png',
    hash: 'created-hash',
    sizeBytes: 10,
    localPath: 'desktop-media:media/story/before.png',
  });
  await service.updateGallery('local-user', created.id, { title: 'Depois' });
  const afterMetadata = await service.getById(created.id);
  await service.setLocalFileState(created.id, {
    localPath: 'desktop-media:media/story/after.png',
    uploadState: 'uploaded',
  });
  const afterLocalState = await service.getById(created.id);

  expect(afterMetadata).toEqual(expect.objectContaining({ title: 'Depois', version: 2 }));
  expect(afterLocalState).toEqual(
    expect.objectContaining({
      localPath: 'desktop-media:media/story/after.png',
      uploadState: 'uploaded',
      version: 2,
    }),
  );
});

it('soft-deletes gallery relations together with a removed gallery', async () => {
  await database.db.insert(schema.galleries).values({
    id: 'gallery',
    storyId: TEST_STORY_ID,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'gallery.png',
    hash: 'gallery-hash',
    sizeBytes: 10,
    ...entityBase,
  });
  await database.db.insert(schema.galleryRelations).values({
    id: 'gallery-link',
    storyId: TEST_STORY_ID,
    galleryId: 'gallery',
    ownerId: 'character',
    ownerType: 'Character',
    ...entityBase,
  });

  await createGalleryService(database.db).deleteGallery('local-user', 'gallery');

  expect(
    await database.db.query.galleries.findFirst({ where: (row, { eq }) => eq(row.id, 'gallery') }),
  ).toEqual(expect.objectContaining({ isDeleted: true, version: 2 }));
  expect(
    await database.db.query.galleryRelations.findFirst({
      where: (row, { eq }) => eq(row.id, 'gallery-link'),
    }),
  ).toEqual(expect.objectContaining({ isDeleted: true, version: 2 }));
});

it('excludes non-favorites on request', async () => {
  await database.db.insert(schema.galleries).values([
    {
      id: 'map',
      storyId: TEST_STORY_ID,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'map.png',
      hash: 'map-hash',
      sizeBytes: 10,
      isFavorite: true,
      ...entityBase,
    },
    {
      id: 'song',
      storyId: TEST_STORY_ID,
      mediaType: 'audio',
      mimeType: 'audio/mpeg',
      fileName: 'song.mp3',
      hash: 'song-hash',
      sizeBytes: 20,
      isFavorite: false,
      ...entityBase,
    },
  ]);

  const rows = await createGalleryService(database.db).getGalleriesByStoryId(TEST_STORY_ID, {
    favoriteFilterState: 'not-favorite',
  });

  expect(rows.map((row) => row.id)).toEqual(['song']);
});

it('sorts by title, file name, size and timestamps, newest first by default', async () => {
  await database.db.insert(schema.galleries).values([
    {
      id: 'a',
      storyId: TEST_STORY_ID,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'b.png',
      hash: 'a-hash',
      sizeBytes: 30,
      title: 'Bravo',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      version: 1,
      isDeleted: false,
    },
    {
      id: 'b',
      storyId: TEST_STORY_ID,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'a.png',
      hash: 'b-hash',
      sizeBytes: 10,
      title: 'Alpha',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-15T00:00:00.000Z'),
      version: 1,
      isDeleted: false,
    },
  ]);
  const service = createGalleryService(database.db);

  const byTitle = await service.getGalleriesByStoryId(TEST_STORY_ID, {
    sortBy: 'title',
    sortDirection: 'asc',
  });
  expect(byTitle.map((row) => row.id)).toEqual(['b', 'a']);
  const byFile = await service.getGalleriesByStoryId(TEST_STORY_ID, {
    sortBy: 'fileName',
    sortDirection: 'asc',
  });
  expect(byFile.map((row) => row.id)).toEqual(['b', 'a']);
  const bySize = await service.getGalleriesByStoryId(TEST_STORY_ID, {
    sortBy: 'sizeBytes',
    sortDirection: 'desc',
  });
  expect(bySize.map((row) => row.id)).toEqual(['a', 'b']);
  const byUpdated = await service.getGalleriesByStoryId(TEST_STORY_ID, {
    sortBy: 'updatedAt',
    sortDirection: 'asc',
  });
  expect(byUpdated.map((row) => row.id)).toEqual(['b', 'a']);
  const byCreated = await service.getGalleriesByStoryId(TEST_STORY_ID, {
    sortBy: 'createdAt',
    sortDirection: 'asc',
  });
  expect(byCreated.map((row) => row.id)).toEqual(['a', 'b']);
  // Most recent first: what was just added is what the person wants to see.
  const byDefault = await service.getGalleriesByStoryId(TEST_STORY_ID);
  expect(byDefault.map((row) => row.id)).toEqual(['b', 'a']);
});

it('refuses to update a gallery that does not exist', async () => {
  await expect(
    createGalleryService(database.db).updateGallery(TEST_USER_ID, 'missing', { title: 'X' }),
  ).rejects.toThrow('not found for update');
});

it('skips the write and the operation log when the metadata did not change', async () => {
  await database.db.insert(schema.galleries).values({
    id: 'map',
    storyId: TEST_STORY_ID,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'map.png',
    hash: 'map-hash',
    sizeBytes: 10,
    title: 'Map',
    ...entityBase,
  });

  await createGalleryService(database.db).updateGallery(TEST_USER_ID, 'map', { title: 'Map' });

  expect(await database.db.query.operationLogs.findMany()).toEqual([]);
});

it('warns and stays quiet when deleting a gallery that does not exist', async () => {
  await createGalleryService(database.db).deleteGallery(TEST_USER_ID, 'missing');

  expect(console.warn).toHaveBeenCalledWith('Attempted to delete non-existent gallery missing.');
  expect(await database.db.query.operationLogs.findMany()).toEqual([]);
});
