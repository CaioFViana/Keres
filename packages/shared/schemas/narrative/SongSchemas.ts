import { z } from 'zod';

/** Limits sized on real songs: the longest narrative ballad in English runs about 11 KB with its chords. */
export const MAX_SONG_TITLE_LENGTH = 200;
export const MAX_SONG_NOTES_LENGTH = 8_000;
export const MAX_SONG_LYRICS_LENGTH = 16_000;
export const MAX_SONG_TRANSLATION_LENGTH = 16_000;
export const MAX_SONG_MELODY_LENGTH = 8_000;

export const MIN_SONG_TEMPO = 20;
export const MAX_SONG_TEMPO = 300;

const KeySchema = z
  .string()
  .max(12)
  .regex(/^[A-G][#b]?(m|min|minor|maj|major)?$/, 'Not a key (G, Em, Bb...).');
const MeterSchema = z.string().regex(/^\d{1,2}\/(1|2|4|8|16)$/, 'Not a meter (3/4, 6/8...).');

/** The stored row. */
export const SongSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  title: z.string().min(1).max(MAX_SONG_TITLE_LENGTH),
  notes: z.string().max(MAX_SONG_NOTES_LENGTH).nullable().default(null),
  lyrics: z.string().max(MAX_SONG_LYRICS_LENGTH).default(''),
  lyricsTranslation: z.string().max(MAX_SONG_TRANSLATION_LENGTH).nullable().default(null),
  melody: z.string().max(MAX_SONG_MELODY_LENGTH).nullable().default(null),
  key: KeySchema.nullable().default(null),
  tempo: z.number().int().min(MIN_SONG_TEMPO).max(MAX_SONG_TEMPO).nullable().default(null),
  meter: MeterSchema.nullable().default(null),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

const SongBaseData = SongSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
});

export const CreateSongDataSchema = SongBaseData;

export const PartialSongSchema = SongBaseData.partial();

export type CreateSongDataType = z.infer<typeof CreateSongDataSchema>;
export type SongType = z.infer<typeof SongSchema>;
