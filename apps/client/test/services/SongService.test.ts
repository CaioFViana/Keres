/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import {
  createSongService,
  normalizeSongFields,
} from '../../src/services/storymanagement/SongService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const service = () => createSongService(database.db);

const operations = async () =>
  database.db
    .select()
    .from(schema.operationLogs)
    .where(eq(schema.operationLogs.storyId, TEST_STORY_ID))
    .all();

const payloadOf = (operation: { payload: unknown }) =>
  typeof operation.payload === 'string' ? JSON.parse(operation.payload) : operation.payload;

const add = (title: string, rest = {}) =>
  service().createSong(TEST_USER_ID, { storyId: TEST_STORY_ID, title, ...rest });

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

describe('normalizeSongFields', () => {
  it('trims the title, ends lines the same way and stores nothing for a text that says nothing', () => {
    expect(
      normalizeSongFields({
        title: '  Tavern song ',
        lyrics: 'One\r\nTwo  \r\n\r\n',
        notes: '   ',
        lyricsTranslation: '',
        melody: null,
        key: ' G ',
        meter: '',
      }),
    ).toEqual({
      title: 'Tavern song',
      lyrics: 'One\nTwo',
      notes: null,
      lyricsTranslation: null,
      melody: null,
      key: 'G',
      meter: null,
    });
  });

  it('refuses a song with no title, and what the server would refuse', () => {
    expect(() => normalizeSongFields({ title: '   ' })).toThrow();
    expect(() => normalizeSongFields({ tempo: 5 })).toThrow();
    expect(() => normalizeSongFields({ key: 'H' })).toThrow();
    expect(() => normalizeSongFields({ meter: '3/5' })).toThrow();
    expect(() => normalizeSongFields({ lyrics: 'x'.repeat(16_001) })).toThrow();
  });

  it('touches only the fields it is given', () => {
    expect(normalizeSongFields({ tempo: 100 })).toEqual({ tempo: 100 });
  });
});

describe('SongService', () => {
  it('creates a song from a title alone, and logs version 1', async () => {
    const song = await add('Tavern song');

    expect(song).toMatchObject({
      title: 'Tavern song',
      lyrics: '',
      notes: null,
      lyricsTranslation: null,
      melody: null,
      key: null,
      tempo: null,
      meter: null,
      version: 1,
    });
    const [operation] = await operations();
    expect(operation).toMatchObject({
      entityType: 'Song',
      operationType: 'create',
      entityId: song.id,
    });
    expect(payloadOf(operation)).toMatchObject({ title: 'Tavern song', version: 1 });
  });

  it('keeps everything a song is given', async () => {
    const song = await add('Hymn', {
      lyrics: '{soc: Chorus}\n[G]Sing\n{eoc}',
      lyricsTranslation: 'Canta',
      notes: 'Sung at dawn',
      key: 'G',
      tempo: 80,
      meter: '3/4',
    });

    expect(song).toMatchObject({
      lyrics: '{soc: Chorus}\n[G]Sing\n{eoc}',
      lyricsTranslation: 'Canta',
      notes: 'Sung at dawn',
      key: 'G',
      tempo: 80,
      meter: '3/4',
    });
  });

  it('refuses to create a song with no title', async () => {
    await expect(add('  ')).rejects.toThrow();
    expect(await service().getSongsForStory(TEST_STORY_ID)).toEqual([]);
  });

  it('lists the songs of the story by title and leaves out the deleted', async () => {
    await add('Zither');
    const gone = await add('Ballad');
    await add('Anthem');
    await service().deleteSong(TEST_USER_ID, gone.id);

    const titles = (await service().getSongsForStory(TEST_STORY_ID)).map((song) => song.title);

    expect(titles).toEqual(['Anthem', 'Zither']);
  });

  it('changes only the fields named and logs only those', async () => {
    const song = await add('Hymn', { lyrics: 'old', tempo: 80 });

    const edited = await service().updateSong(TEST_USER_ID, song.id, { lyrics: 'new' });

    expect(edited).toMatchObject({ lyrics: 'new', tempo: 80, title: 'Hymn', version: 2 });
    const update = (await operations()).find((operation) => operation.operationType === 'update');
    expect(payloadOf(update as never)).toMatchObject({ lyrics: 'new' });
    expect(Object.keys(payloadOf(update as never))).not.toContain('tempo');
  });

  it('writes nothing for a change that changes nothing', async () => {
    const song = await add('Hymn', { lyrics: 'same' });

    const same = await service().updateSong(TEST_USER_ID, song.id, {
      lyrics: 'same\r\n',
      title: ' Hymn ',
    });

    expect(same.version).toBe(1);
    expect((await operations()).filter((o) => o.operationType === 'update')).toHaveLength(0);
  });

  it('clears a field back to nothing', async () => {
    const song = await add('Hymn', { key: 'G', tempo: 90, lyricsTranslation: 'x' });

    const cleared = await service().updateSong(TEST_USER_ID, song.id, {
      key: null,
      tempo: null,
      lyricsTranslation: '',
    });

    expect(cleared).toMatchObject({ key: null, tempo: null, lyricsTranslation: null });
  });

  it('refuses an edit that breaks a limit, and keeps the song as it was', async () => {
    const song = await add('Hymn', { tempo: 90 });

    await expect(service().updateSong(TEST_USER_ID, song.id, { tempo: 999 })).rejects.toThrow();
    await expect(service().updateSong(TEST_USER_ID, song.id, { title: '' })).rejects.toThrow();

    expect((await service().getById(song.id))?.tempo).toBe(90);
  });

  it('deletes a song as a tombstone', async () => {
    const song = await add('Hymn');

    await service().deleteSong(TEST_USER_ID, song.id);

    expect((await service().getById(song.id))?.isDeleted).toBe(true);
    expect((await operations()).at(-1)).toMatchObject({
      entityType: 'Song',
      operationType: 'delete',
    });
  });

  it('ignores the delete of a song that is not there, and refuses to change one', async () => {
    await expect(service().deleteSong(TEST_USER_ID, 'nope')).resolves.toBeUndefined();
    await expect(service().updateSong(TEST_USER_ID, 'nope', { tempo: 90 })).rejects.toThrow();
  });

  it('refuses to write to a story that is read-only to this person', async () => {
    await database.db
      .update(schema.stories)
      .set({ serverId: 'srv', myRole: 'reader' } as never)
      .where(eq(schema.stories.id, TEST_STORY_ID));

    await expect(add('Hymn')).rejects.toThrow();
  });
});
