/**
 * @jest-environment node
 */
import { compareRanked } from '@keres/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import {
  createSceneMusicService,
  groupMusicByScene,
  musicHasTarget,
  normalizeSections,
} from '../../src/services/storymanagement/SceneMusicService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const service = () => createSceneMusicService(database.db);

const operations = async () =>
  database.db
    .select()
    .from(schema.operationLogs)
    .where(eq(schema.operationLogs.storyId, TEST_STORY_ID))
    .all();

const payloadOf = (operation: { payload: unknown }) =>
  typeof operation.payload === 'string' ? JSON.parse(operation.payload) : operation.payload;

async function seedScene(id: string, overrides: Partial<typeof schema.scenes.$inferInsert> = {}) {
  await database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId: null,
    locationId: null,
    name: id,
    index: 1,
    rank: 'a0',
    ...entityBase,
    ...overrides,
  } as never);
}

const addMusic = (sceneId: string, target: { songId: string } | { galleryId: string }, rest = {}) =>
  service().addMusic(TEST_USER_ID, { storyId: TEST_STORY_ID, sceneId, target, ...rest });

const cuesOf = async (sceneId: string) =>
  (await service().getMusicForScene(sceneId)).map((music) => music.cue);

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await seedScene('scene-1');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('SceneMusicService', () => {
  it('adds a song as in-world music with its cue, and logs version 1', async () => {
    const music = await addMusic('scene-1', { songId: 'song-1' }, { cue: 'as she sings' });

    expect(music).toMatchObject({
      sceneId: 'scene-1',
      songId: 'song-1',
      galleryId: null,
      role: 'in-world',
      cue: 'as she sings',
      sections: null,
      version: 1,
    });
    const [operation] = await operations();
    expect(operation).toMatchObject({
      entityType: 'SceneMusic',
      operationType: 'create',
      entityId: music.id,
    });
    expect(payloadOf(operation)).toMatchObject({ songId: 'song-1', galleryId: null, version: 1 });
  });

  it('adds a Gallery medium as score unless it is told otherwise', async () => {
    const score = await addMusic('scene-1', { galleryId: 'g-1' });
    const heard = await addMusic('scene-1', { galleryId: 'g-2' }, { role: 'in-world' });

    expect(score).toMatchObject({ galleryId: 'g-1', songId: null, role: 'score', cue: null });
    expect(heard.role).toBe('in-world');
  });

  it('keeps the sections of a song and drops them for a medium, which has no sections', async () => {
    const song = await addMusic(
      'scene-1',
      { songId: 's' },
      { sections: [' Chorus ', 'Chorus', ''] },
    );
    const medium = await addMusic('scene-1', { galleryId: 'g' }, { sections: ['Chorus'] });

    expect(song.sections).toEqual(['Chorus']);
    expect(medium.sections).toBeNull();
  });

  it("keeps a scene's music in the order it was added, each after the last", async () => {
    await addMusic('scene-1', { galleryId: 'g' }, { cue: 'one' });
    await addMusic('scene-1', { galleryId: 'g' }, { cue: 'two' });
    await addMusic('scene-1', { galleryId: 'g' }, { cue: 'three' });

    expect(await cuesOf('scene-1')).toEqual(['one', 'two', 'three']);
  });

  it('adds music at a place among the others, and clamps a place off the ends', async () => {
    await addMusic('scene-1', { galleryId: 'g' }, { cue: 'one' });
    await addMusic('scene-1', { galleryId: 'g' }, { cue: 'three' });
    await addMusic('scene-1', { galleryId: 'g' }, { cue: 'two', position: 1 });
    await addMusic('scene-1', { galleryId: 'g' }, { cue: 'first', position: -5 });
    await addMusic('scene-1', { galleryId: 'g' }, { cue: 'last', position: 99 });

    expect(await cuesOf('scene-1')).toEqual(['first', 'one', 'two', 'three', 'last']);
  });

  it('moves one link by changing only its own rank and logging only that update', async () => {
    const one = await addMusic('scene-1', { galleryId: 'g' }, { cue: 'one' });
    const two = await addMusic('scene-1', { galleryId: 'g' }, { cue: 'two' });
    const three = await addMusic('scene-1', { galleryId: 'g' }, { cue: 'three' });

    const moved = await service().moveMusic(TEST_USER_ID, three.id, 0);

    expect(await cuesOf('scene-1')).toEqual(['three', 'one', 'two']);
    expect(moved.version).toBe(2);
    for (const untouched of [one, two]) {
      const row = await service().getById(untouched.id);
      expect(row?.version).toBe(1);
      expect(row?.rank).toBe(untouched.rank);
    }
    const log = (await operations()).filter((operation) => operation.operationType === 'update');
    expect(log).toHaveLength(1);
    expect(payloadOf(log[0])).toMatchObject({ rank: moved.rank });
    expect(Object.keys(payloadOf(log[0]))).not.toContain('cue');
  });

  it('edits the cue, the role and the sections, and skips a change that changes nothing', async () => {
    const music = await addMusic('scene-1', { songId: 's' }, { cue: 'one' });

    const edited = await service().updateMusic(TEST_USER_ID, music.id, {
      cue: 'one, edited',
      role: 'score',
      sections: ['Chorus'],
    });
    expect(edited).toMatchObject({
      cue: 'one, edited',
      role: 'score',
      sections: ['Chorus'],
      version: 2,
    });
    const same = await service().updateMusic(TEST_USER_ID, music.id, { role: 'score' });
    expect(same.version).toBe(2);
    const cleared = await service().updateMusic(TEST_USER_ID, music.id, {
      cue: '   ',
      sections: [],
    });
    expect(cleared).toMatchObject({ cue: null, sections: null, version: 3 });
  });

  it('points the link at another target, clearing the old one and the sections in the same change', async () => {
    const music = await addMusic(
      'scene-1',
      { galleryId: 'g-1' },
      { cue: 'keep me', sections: ['Chorus'] },
    );
    const song = await addMusic('scene-1', { songId: 's-1' }, { sections: ['Chorus'] });

    const retargeted = await service().retarget(TEST_USER_ID, song.id, { songId: 's-2' });
    const toMedium = await service().retarget(TEST_USER_ID, music.id, { songId: 's-9' });

    expect(retargeted).toMatchObject({ songId: 's-2', galleryId: null, sections: null });
    expect(toMedium).toMatchObject({ songId: 's-9', galleryId: null, cue: 'keep me' });
    const log = (await operations()).filter((operation) => operation.operationType === 'update');
    expect(payloadOf(log[1])).toMatchObject({ songId: 's-9', galleryId: null });
    expect(Object.keys(payloadOf(log[1]))).not.toContain('cue');
  });

  it('deletes a link as a tombstone and leaves it out of the scene', async () => {
    const music = await addMusic('scene-1', { galleryId: 'g' }, { cue: 'one' });
    await addMusic('scene-1', { galleryId: 'g' }, { cue: 'two' });

    await service().deleteMusic(TEST_USER_ID, music.id);

    expect(await cuesOf('scene-1')).toEqual(['two']);
    expect((await service().getById(music.id))?.isDeleted).toBe(true);
    const last = (await operations()).at(-1);
    expect(last).toMatchObject({ entityType: 'SceneMusic', operationType: 'delete' });
  });

  it('ignores the delete of a link that is not there', async () => {
    await expect(service().deleteMusic(TEST_USER_ID, 'nope')).resolves.toBeUndefined();
  });

  it('refuses to change, move or point a link that is not there', async () => {
    await expect(service().updateMusic(TEST_USER_ID, 'nope', { role: 'score' })).rejects.toThrow();
    await expect(service().moveMusic(TEST_USER_ID, 'nope', 0)).rejects.toThrow();
    await expect(service().retarget(TEST_USER_ID, 'nope', { songId: 's' })).rejects.toThrow();
  });

  it('reads the music of the story by scene and leaves out that of a deleted scene', async () => {
    await seedScene('scene-2');
    await seedScene('scene-3');
    await addMusic('scene-1', { galleryId: 'g' }, { cue: 'a1' });
    await addMusic('scene-2', { galleryId: 'g' }, { cue: 'b1' });
    await addMusic('scene-2', { galleryId: 'g' }, { cue: 'b2' });
    await addMusic('scene-3', { galleryId: 'g' }, { cue: 'c1' });
    await database.db
      .update(schema.scenes)
      .set({ isDeleted: true })
      .where(eq(schema.scenes.id, 'scene-3'));

    const music = await service().getMusicForStory(TEST_STORY_ID);

    expect(music.map((item) => item.cue)).toEqual(['a1', 'b1', 'b2']);
    const grouped = groupMusicByScene(music);
    expect([...grouped.keys()]).toEqual(['scene-1', 'scene-2']);
    expect(grouped.get('scene-2')?.map((item) => item.cue)).toEqual(['b1', 'b2']);
  });

  it('gives an empty story no music', async () => {
    await database.db.delete(schema.scenes);
    expect(await service().getMusicForStory(TEST_STORY_ID)).toEqual([]);
  });

  it('tells a link that lost its target from one that has it', async () => {
    const music = await addMusic('scene-1', { galleryId: 'g' }, { cue: 'one' });
    expect(musicHasTarget(music)).toBe(true);
    expect(musicHasTarget({ ...music, galleryId: null })).toBe(false);
    expect(musicHasTarget({ ...music, galleryId: null, songId: 's' })).toBe(true);
  });

  it('refuses to write to a story that is read-only to this person', async () => {
    await database.db
      .update(schema.stories)
      .set({ serverId: 'srv', myRole: 'reader' } as never)
      .where(eq(schema.stories.id, TEST_STORY_ID));

    await expect(addMusic('scene-1', { galleryId: 'g' })).rejects.toThrow();
  });

  it('orders by rank then id, the one order every device uses', () => {
    const rows = [
      { rank: 'a1', id: 'b' },
      { rank: 'a1', id: 'a' },
      { rank: 'a0', id: 'z' },
    ];

    expect([...rows].sort(compareRanked).map((row) => row.id)).toEqual(['z', 'a', 'b']);
  });

  it('normalizes sections: trimmed, without repeats, nothing is the whole song', () => {
    expect(normalizeSections([' Verse 1', 'Verse 1', 'Chorus '])).toEqual(['Verse 1', 'Chorus']);
    expect(normalizeSections([])).toBeNull();
    expect(normalizeSections(['  '])).toBeNull();
    expect(normalizeSections(null)).toBeNull();
    expect(normalizeSections(undefined)).toBeNull();
  });
});
