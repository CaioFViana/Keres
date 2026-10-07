/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import { createSceneMusicService } from '../../src/services/storymanagement/SceneMusicService';
import { createStoryAnalysisService } from '../../src/services/storymanagement/StoryAnalysisService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const newMedium = (fileName: string) =>
  createGalleryService(database.db).createGallery(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    mediaType: 'audio',
    mimeType: 'audio/mpeg',
    fileName,
    hash: fileName,
    sizeBytes: 1,
    localPath: `/media/${fileName}`,
    title: fileName,
  } as never);

const musicFindings = async () =>
  (await createStoryAnalysisService(database.db).analyzeStoryCheap(TEST_STORY_ID)).findings.filter(
    (finding) => finding.category === 'music',
  );

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.scenes).values({
    id: 'scene-1',
    storyId: TEST_STORY_ID,
    chapterId: null,
    locationId: null,
    name: 'The tavern',
    index: 1,
    rank: 'a0',
    ...entityBase,
  } as never);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('Story Analysis of the music of a scene', () => {
  it('finds nothing wrong with music that points at a medium that is there', async () => {
    const medium = await newMedium('tavern.mp3');
    await createSceneMusicService(database.db).addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 'scene-1',
      target: { galleryId: medium.id },
    });

    expect(await musicFindings()).toEqual([]);
  });

  it('finds the music whose medium was deleted, and the music of a medium that never existed', async () => {
    const gone = await newMedium('gone.mp3');
    const music = createSceneMusicService(database.db);
    await music.addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 'scene-1',
      target: { galleryId: gone.id },
    });
    await music.addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 'scene-1',
      target: { galleryId: 'never-there' },
    });
    await database.db
      .update(schema.galleries)
      .set({ isDeleted: true })
      .where(eq(schema.galleries.id, gone.id));

    const findings = await musicFindings();

    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      messageKey: 'analysis_music_target_gone',
      entityType: 'Scene',
      entityId: 'scene-1',
    });
  });

  it('does not count deleted music', async () => {
    const music = createSceneMusicService(database.db);
    const link = await music.addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 'scene-1',
      target: { galleryId: 'never-there' },
    });
    await music.deleteMusic(TEST_USER_ID, link.id);

    expect(await musicFindings()).toEqual([]);
  });
});
