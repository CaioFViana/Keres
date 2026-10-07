/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import { loadCueSheet } from '../../src/services/storymanagement/CueSheetService';
import { createSceneMusicService } from '../../src/services/storymanagement/SceneMusicService';
import { createSongService } from '../../src/services/storymanagement/SongService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const addScene = (id: string, name: string, chapterId: string | null, index: number) =>
  database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId,
    locationId: null,
    name,
    index,
    rank: `a${index}`,
    ...entityBase,
  } as never);

const music = () => createSceneMusicService(database.db);
const songs = () => createSongService(database.db);

const lyrics = '{sov: Verse 1}\n[G]One two [C]three four\n{eov}\n{soc: Chorus}\n[D]La la\n{eoc}';

const newLink = (url: string | null, fileName: string, title: string | null = fileName) =>
  createGalleryService(database.db).createGallery(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    mediaType: url ? 'link' : 'audio',
    mimeType: url ? 'text/uri-list' : 'audio/mpeg',
    fileName,
    hash: fileName.padEnd(32, '0').slice(0, 32),
    sizeBytes: 1,
    localPath: url ? undefined : `/media/${fileName}`,
    sourceUrl: url,
    title,
  } as never);

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.chapters).values([
    { id: 'ch-1', storyId: TEST_STORY_ID, name: 'One', index: 1, ...entityBase },
    { id: 'ch-2', storyId: TEST_STORY_ID, name: 'Two', index: 2, ...entityBase },
  ] as never);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('loadCueSheet', () => {
  it('is empty for a story with no music', async () => {
    await addScene('s-1', 'The tavern', 'ch-1', 1);

    expect(await loadCueSheet(database.db, TEST_STORY_ID, 'en')).toEqual([]);
  });

  it('lists the music in the order the story is read, a scene’s pieces in the order they were arranged', async () => {
    await addScene('s-late', 'The funeral', 'ch-2', 1);
    await addScene('s-early', 'The tavern', 'ch-1', 1);
    const song = await songs().createSong(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'The Lantern Song',
      lyrics,
      key: 'G',
      tempo: 120,
      meter: '4/4',
    });
    const medium = await newLink('https://example.org/theme', 'theme.url', 'Theme');
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-late',
      target: { songId: song.id },
    });
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-early',
      target: { galleryId: medium.id },
      cue: 'under the fight',
    });
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-early',
      target: { songId: song.id },
      sections: ['Chorus'],
    });

    const rows = await loadCueSheet(database.db, TEST_STORY_ID, 'en');

    expect(rows.map((row) => [row.chapter, row.scene, row.kind])).toEqual([
      ['One', 'The tavern', 'medium'],
      ['One', 'The tavern', 'song'],
      ['Two', 'The funeral', 'song'],
    ]);
  });

  it('gives a medium its link and its name and a song its facts, length and the words sung', async () => {
    await addScene('s-1', 'The tavern', 'ch-1', 1);
    const song = await songs().createSong(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'The Lantern Song',
      lyrics,
      key: 'G',
      tempo: 120,
      meter: '4/4',
    });
    const medium = await newLink('https://example.org/theme', 'theme.url', 'Theme');
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-1',
      target: { galleryId: medium.id },
      cue: 'under the fight',
    });
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-1',
      target: { songId: song.id },
      sections: ['Chorus'],
    });

    const [theme, sung] = await loadCueSheet(database.db, TEST_STORY_ID, 'en');

    expect(theme).toMatchObject({
      music: 'Theme',
      reference: 'https://example.org/theme',
      role: 'score',
      cue: 'under the fight',
      seconds: null,
      lyrics: null,
      key: null,
    });
    expect(sung).toMatchObject({
      music: 'The Lantern Song',
      reference: null,
      role: 'in-world',
      key: 'G',
      tempo: 120,
      meter: '4/4',
      sections: ['Chorus'],
      // One chord, a bar of four beats at 120: two seconds.
      seconds: 2,
      lyrics: 'La la',
    });
  });

  it('names a file when a medium is not a link, and leaves a soundtrack song unsung', async () => {
    await addScene('s-1', 'The tavern', 'ch-1', 1);
    const file = await newLink(null, 'tavern.mp3', null);
    const song = await songs().createSong(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'The Lantern Song',
      lyrics,
    });
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-1',
      target: { galleryId: file.id },
    });
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-1',
      target: { songId: song.id },
      role: 'score',
    });

    const [medium, score] = await loadCueSheet(database.db, TEST_STORY_ID, 'en');

    expect(medium).toMatchObject({ music: 'tavern.mp3', reference: 'tavern.mp3' });
    expect(score).toMatchObject({ role: 'score', lyrics: null });
    expect(score.seconds).toBeGreaterThan(0);
  });

  it('keeps the cue of music whose song or medium is gone, and says it is', async () => {
    await addScene('s-1', 'The tavern', 'ch-1', 1);
    const song = await songs().createSong(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Gone',
      lyrics,
    });
    const medium = await newLink('https://example.org/x', 'x.url');
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-1',
      target: { songId: song.id },
      cue: 'at dawn',
    });
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-1',
      target: { galleryId: medium.id },
      cue: 'at dusk',
    });
    await songs().deleteSong(TEST_USER_ID, song.id);
    await database.db
      .update(schema.galleries)
      .set({ isDeleted: true })
      .where(eq(schema.galleries.id, medium.id));

    const rows = await loadCueSheet(database.db, TEST_STORY_ID, 'en');

    expect(rows.map((row) => [row.music, row.cue, row.seconds, row.reference])).toEqual([
      [null, 'at dawn', null, null],
      [null, 'at dusk', null, null],
    ]);
  });

  it('leaves out the music of a scene that was deleted', async () => {
    await addScene('s-1', 'The tavern', 'ch-1', 1);
    const song = await songs().createSong(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'The Lantern Song',
      lyrics,
    });
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-1',
      target: { songId: song.id },
    });
    await database.db
      .update(schema.scenes)
      .set({ isDeleted: true })
      .where(eq(schema.scenes.id, 's-1'));

    expect(await loadCueSheet(database.db, TEST_STORY_ID, 'en')).toEqual([]);
  });

  it('measures a song by its tune when it has one', async () => {
    await addScene('s-1', 'The tavern', 'ch-1', 1);
    const song = await songs().createSong(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'The Lantern Song',
      lyrics,
      tempo: 120,
      meter: '4/4',
      melody: 'P:Verse 1\nC D E F\nP:Chorus\ng a',
    });
    await music().addMusic(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      sceneId: 's-1',
      target: { songId: song.id },
    });

    const [row] = await loadCueSheet(database.db, TEST_STORY_ID, 'en');

    // Two sections of one bar each, two seconds a bar.
    expect(row.seconds).toBe(4);
  });
});
