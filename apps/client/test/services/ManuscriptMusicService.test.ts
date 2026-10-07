/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import {
  loadManuscriptMusic,
  storyHasMusic,
  storyMusicFacts,
  withManuscriptMusic,
} from '../../src/services/storymanagement/ManuscriptMusicService';
import { createSceneMusicService } from '../../src/services/storymanagement/SceneMusicService';
import { createSongService } from '../../src/services/storymanagement/SongService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

async function seedScene(id: string) {
  await database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId: null,
    locationId: null,
    name: id,
    index: 1,
    rank: 'a0',
    ...entityBase,
  } as never);
}

const newMedium = (fileName: string, title: string | null) =>
  createGalleryService(database.db).createGallery(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    mediaType: 'audio',
    mimeType: 'audio/mpeg',
    fileName,
    hash: fileName,
    sizeBytes: 1,
    localPath: `/media/${fileName}`,
    title,
  } as never);

const add = (sceneId: string, galleryId: string, rest = {}) =>
  createSceneMusicService(database.db).addMusic(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    sceneId,
    target: { galleryId },
    ...rest,
  });

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await seedScene('scene-1');
  await seedScene('scene-2');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('loadManuscriptMusic', () => {
  it('names each piece by the title of its medium, or its file name, with its role and cue', async () => {
    const titled = await newMedium('a.mp3', 'Tavern song');
    const plain = await newMedium('b.mp3', null);
    await add('scene-1', titled.id, { role: 'in-world', cue: 'as she sings' });
    await add('scene-1', plain.id);

    const music = await loadManuscriptMusic(database.db, TEST_STORY_ID);

    expect(music.get('scene-1')).toEqual([
      expect.objectContaining({ title: 'Tavern song', role: 'in-world', cue: 'as she sings' }),
      expect.objectContaining({ title: 'b.mp3', role: 'score', cue: null }),
    ]);
  });

  it('leaves the title empty where the medium is gone, keeping the cue', async () => {
    const gone = await newMedium('gone.mp3', 'Gone');
    await add('scene-1', gone.id, { cue: 'at the door' });
    await database.db
      .update(schema.galleries)
      .set({ isDeleted: true })
      .where(eq(schema.galleries.id, gone.id));

    const music = await loadManuscriptMusic(database.db, TEST_STORY_ID);

    expect(music.get('scene-1')).toEqual([
      expect.objectContaining({ title: null, cue: 'at the door' }),
    ]);
  });

  it('reads only the scenes asked for', async () => {
    const medium = await newMedium('a.mp3', 'A');
    await add('scene-1', medium.id);
    await add('scene-2', medium.id);

    const music = await loadManuscriptMusic(database.db, TEST_STORY_ID, {
      sceneIds: new Set(['scene-2']),
    });

    expect([...music.keys()]).toEqual(['scene-2']);
  });
});

describe('withManuscriptMusic', () => {
  it('attaches the music to the scenes that have some and leaves the others as they were', () => {
    const scenes = [{ id: 'a' }, { id: 'b' }];
    const music = new Map([['a', [{ id: 'm', role: 'score' as const, title: 'T', cue: null }]]]);

    const result = withManuscriptMusic(scenes, music);

    expect(result[0]).toEqual({ id: 'a', music: [expect.objectContaining({ title: 'T' })] });
    expect(result[1]).toBe(scenes[1]);
  });

  it('hands the scenes back as they are without music', () => {
    const scenes = [{ id: 'a' }];

    expect(withManuscriptMusic(scenes, null)).toEqual(scenes);
  });
});

describe('storyHasMusic', () => {
  it('knows whether any scene has music', async () => {
    expect(await storyHasMusic(database.db, TEST_STORY_ID)).toBe(false);
    const medium = await newMedium('a.mp3', 'A');
    await add('scene-1', medium.id);
    expect(await storyHasMusic(database.db, TEST_STORY_ID)).toBe(true);
  });
});

describe('loadManuscriptMusic for a song', () => {
  const newSong = (title: string, rest = {}) =>
    createSongService(database.db).createSong(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title,
      lyrics: '{soc: Chorus}\nHome',
      lyricsTranslation: '{soc: Chorus}\nCasa',
      ...rest,
    });
  const sing = (sceneId: string, songId: string, rest = {}) =>
    createSceneMusicService(database.db).addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId,
      target: { songId },
      ...rest,
    });

  it('names the music by the title of the song, and carries no words unless asked', async () => {
    const song = await newSong('The Lantern Song');
    await sing('scene-1', song.id, { cue: 'as she sings' });

    const music = await loadManuscriptMusic(database.db, TEST_STORY_ID);

    expect(music.get('scene-1')).toEqual([
      expect.objectContaining({ title: 'The Lantern Song', role: 'in-world', cue: 'as she sings' }),
    ]);
    expect(music.get('scene-1')?.[0].song).toBeUndefined();
  });

  it('carries the words of a song sung in the story, with the sections the scene names', async () => {
    const song = await newSong('The Lantern Song');
    await sing('scene-1', song.id, { sections: ['Chorus'] });

    const music = await loadManuscriptMusic(database.db, TEST_STORY_ID, { withSongs: true });

    expect(music.get('scene-1')?.[0].song).toEqual({
      id: song.id,
      title: 'The Lantern Song',
      lyrics: '{soc: Chorus}\nHome',
      lyricsTranslation: '{soc: Chorus}\nCasa',
      sections: ['Chorus'],
    });
  });

  it('carries no words for a song that only plays under the scene', async () => {
    const song = await newSong('Theme');
    await sing('scene-1', song.id, { role: 'score' });

    const music = await loadManuscriptMusic(database.db, TEST_STORY_ID, { withSongs: true });

    expect(music.get('scene-1')?.[0]).toMatchObject({ role: 'score', title: 'Theme' });
    expect(music.get('scene-1')?.[0].song).toBeUndefined();
  });

  it('leaves the title and the words out where the song was deleted', async () => {
    const song = await newSong('Gone');
    await sing('scene-1', song.id);
    await createSongService(database.db).deleteSong(TEST_USER_ID, song.id);

    const music = await loadManuscriptMusic(database.db, TEST_STORY_ID, { withSongs: true });

    expect(music.get('scene-1')?.[0].title).toBeNull();
    expect(music.get('scene-1')?.[0].song).toBeUndefined();
  });
});

describe('storyMusicFacts', () => {
  it('knows whether a song is sung in the story, apart from whether there is any music', async () => {
    expect(await storyMusicFacts(database.db, TEST_STORY_ID)).toEqual({
      hasMusic: false,
      hasSungSongs: false,
    });

    const medium = await newMedium('a.mp3', 'A');
    await add('scene-1', medium.id);
    expect(await storyMusicFacts(database.db, TEST_STORY_ID)).toEqual({
      hasMusic: true,
      hasSungSongs: false,
    });

    const song = await createSongService(database.db).createSong(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'S',
    });
    await createSceneMusicService(database.db).addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 'scene-1',
      target: { songId: song.id },
      role: 'score',
    });
    expect((await storyMusicFacts(database.db, TEST_STORY_ID)).hasSungSongs).toBe(false);

    await createSceneMusicService(database.db).addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 'scene-2',
      target: { songId: song.id },
    });
    expect((await storyMusicFacts(database.db, TEST_STORY_ID)).hasSungSongs).toBe(true);
  });
});
