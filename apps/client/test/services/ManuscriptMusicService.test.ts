/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import {
  loadManuscriptMusic,
  storyHasMusic,
  withManuscriptMusic,
} from '../../src/services/storymanagement/ManuscriptMusicService';
import { createSceneMusicService } from '../../src/services/storymanagement/SceneMusicService';
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

    const music = await loadManuscriptMusic(database.db, TEST_STORY_ID, new Set(['scene-2']));

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
