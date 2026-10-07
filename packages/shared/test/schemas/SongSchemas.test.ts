import { describe, expect, it } from 'vitest';
import {
  CreateSongDataSchema,
  MAX_SONG_LYRICS_LENGTH,
  MAX_SONG_MELODY_LENGTH,
  MAX_SONG_NOTES_LENGTH,
  MAX_SONG_TRANSLATION_LENGTH,
  PartialSongSchema,
  SongSchema,
} from '../../schemas/SongSchemas';

describe('Song schemas', () => {
  it('makes a song from a title alone, with the rest empty', () => {
    expect(CreateSongDataSchema.parse({ title: 'Tavern song' })).toEqual({
      title: 'Tavern song',
      notes: null,
      lyrics: '',
      lyricsTranslation: null,
      melody: null,
      key: null,
      tempo: null,
      meter: null,
    });
  });

  it('refuses a song with no title', () => {
    expect(CreateSongDataSchema.safeParse({ title: '' }).success).toBe(false);
    expect(CreateSongDataSchema.safeParse({}).success).toBe(false);
  });

  it('knows a key, a meter and a tempo when they look like one', () => {
    const song = { title: 'T', key: 'F#m', meter: '6/8', tempo: 120 };

    expect(CreateSongDataSchema.safeParse(song).success).toBe(true);
    expect(CreateSongDataSchema.safeParse({ ...song, key: 'H' }).success).toBe(false);
    expect(CreateSongDataSchema.safeParse({ ...song, meter: '3/5' }).success).toBe(false);
    expect(CreateSongDataSchema.safeParse({ ...song, meter: 'waltz' }).success).toBe(false);
    expect(CreateSongDataSchema.safeParse({ ...song, tempo: 10 }).success).toBe(false);
    expect(CreateSongDataSchema.safeParse({ ...song, tempo: 400 }).success).toBe(false);
    expect(CreateSongDataSchema.safeParse({ ...song, tempo: 90.5 }).success).toBe(false);
  });

  it('caps what is written at the size of a real song and then some', () => {
    const limit = (field: string, size: number) => ({
      ok: CreateSongDataSchema.safeParse({ title: 'T', [field]: 'x'.repeat(size) }).success,
      over: CreateSongDataSchema.safeParse({ title: 'T', [field]: 'x'.repeat(size + 1) }).success,
    });

    expect(limit('lyrics', MAX_SONG_LYRICS_LENGTH)).toEqual({ ok: true, over: false });
    expect(limit('lyricsTranslation', MAX_SONG_TRANSLATION_LENGTH)).toEqual({
      ok: true,
      over: false,
    });
    expect(limit('notes', MAX_SONG_NOTES_LENGTH)).toEqual({ ok: true, over: false });
    expect(limit('melody', MAX_SONG_MELODY_LENGTH)).toEqual({ ok: true, over: false });
  });

  it('holds the longest narrative ballad there is, with its chords', () => {
    // About 11 KB of words (Robin Hood and the Monk) and a quarter more for the chords.
    expect(MAX_SONG_LYRICS_LENGTH).toBeGreaterThan(14_000);
  });

  it('keeps a stored song as it is', () => {
    const row = SongSchema.parse({
      id: 'song-1',
      storyId: 'story-1',
      title: 'Tavern song',
      lyrics: '[G]Night',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 2,
      isDeleted: false,
      deletedAt: null,
    });

    expect(row.lyrics).toBe('[G]Night');
    expect(row.lyricsTranslation).toBeNull();
  });

  it('accepts a change of one field at a time', () => {
    // The sync handlers keep only the keys a change names, so the defaults here never reach a row.
    expect(PartialSongSchema.parse({ lyrics: 'New' })).toMatchObject({ lyrics: 'New' });
    expect(PartialSongSchema.parse({ tempo: 100 })).toMatchObject({ tempo: 100 });
    expect(PartialSongSchema.safeParse({ tempo: 5 }).success).toBe(false);
  });
});
