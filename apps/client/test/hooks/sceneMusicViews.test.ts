/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { sceneMusicViewOf } from '../../src/hooks/useSceneMusic';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import { createSceneMusicService } from '../../src/services/storymanagement/SceneMusicService';
import { createSongService } from '../../src/services/storymanagement/SongService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

async function seedScene() {
  await database.db.insert(schema.scenes).values({
    id: 'scene-1',
    storyId: TEST_STORY_ID,
    chapterId: null,
    locationId: null,
    name: 'Scene',
    index: 1,
    rank: 'a0',
    ...entityBase,
  } as never);
}

const newMedium = (fileName: string, mediaType: 'audio' | 'link') =>
  createGalleryService(database.db).createGallery(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    mediaType,
    mimeType: mediaType === 'audio' ? 'audio/mpeg' : 'text/uri-list',
    fileName,
    hash: fileName,
    sizeBytes: 1,
    localPath: `/media/${fileName}`,
    title: fileName,
  } as never);

const musicWith = (target: { galleryId: string } | { songId: string }) =>
  createSceneMusicService(database.db).addMusic(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    sceneId: 'scene-1',
    target,
  });

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await seedScene();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('sceneMusicViewOf', () => {
  it('shows an audio file of the Gallery by its name', async () => {
    const medium = await newMedium('tavern.mp3', 'audio');
    const music = await musicWith({ galleryId: medium.id });

    expect(await sceneMusicViewOf(database.db, music)).toEqual({
      music,
      targetKind: 'audio',
      targetName: 'tavern.mp3',
      targetGone: false,
      songSections: [],
      missingSections: [],
    });
  });

  it('shows a link of the Gallery as a link', async () => {
    const medium = await newMedium('playlist', 'link');
    const music = await musicWith({ galleryId: medium.id });

    expect(await sceneMusicViewOf(database.db, music)).toMatchObject({
      targetKind: 'link',
      targetName: 'playlist',
      targetGone: false,
    });
  });

  it('calls music whose medium was deleted "removed", keeping the link', async () => {
    const medium = await newMedium('gone.mp3', 'audio');
    const music = await musicWith({ galleryId: medium.id });
    await database.db
      .update(schema.galleries)
      .set({ isDeleted: true })
      .where(eq(schema.galleries.id, medium.id));

    expect(await sceneMusicViewOf(database.db, music)).toMatchObject({
      targetKind: null,
      targetName: null,
      targetGone: true,
    });
  });

  it('calls music whose medium never existed "removed"', async () => {
    const music = await musicWith({ galleryId: 'never-there' });

    expect(await sceneMusicViewOf(database.db, music)).toMatchObject({ targetGone: true });
  });

  it('calls music with neither target (both cleared by the sync) "removed"', async () => {
    const medium = await newMedium('x.mp3', 'audio');
    const music = await musicWith({ galleryId: medium.id });

    expect(
      await sceneMusicViewOf(database.db, { ...music, galleryId: null, songId: null }),
    ).toMatchObject({ targetGone: true });
  });
});

describe('sceneMusicViewOf for a song', () => {
  const lyrics = '{sov: Verse 1}\none\n{eov}\n{soc: Chorus}\nsing\n{eoc}';
  const newSong = (text = lyrics) =>
    createSongService(database.db).createSong(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Tavern song',
      lyrics: text,
    });

  it('shows a song by its title and the sections its lyrics have', async () => {
    const song = await newSong();
    const music = await musicWith({ songId: song.id });

    expect(await sceneMusicViewOf(database.db, music)).toEqual({
      music,
      targetKind: 'song',
      targetName: 'Tavern song',
      targetGone: false,
      songSections: ['Verse 1', 'Chorus'],
      missingSections: [],
    });
  });

  it('says which of the sections the scene names are no longer in the lyrics', async () => {
    const song = await newSong();
    const music = await createSceneMusicService(database.db).addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 'scene-1',
      target: { songId: song.id },
      sections: ['Chorus', 'Coro'],
    });

    expect(await sceneMusicViewOf(database.db, music)).toMatchObject({
      missingSections: ['Coro'],
    });
  });

  it('calls music whose song was deleted "removed", keeping the link and the sections it named', async () => {
    const song = await newSong();
    const music = await musicWith({ songId: song.id });
    await createSongService(database.db).deleteSong(TEST_USER_ID, song.id);

    expect(await sceneMusicViewOf(database.db, music)).toMatchObject({
      targetKind: null,
      targetName: null,
      targetGone: true,
      songSections: [],
      missingSections: [],
    });
  });

  it('calls music whose song never existed "removed"', async () => {
    const music = await musicWith({ songId: 'never-there' });

    expect(await sceneMusicViewOf(database.db, music)).toMatchObject({ targetGone: true });
  });
});
