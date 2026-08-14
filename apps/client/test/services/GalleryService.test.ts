/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

afterEach(() => database.close());

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
