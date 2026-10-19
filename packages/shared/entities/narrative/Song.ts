/**
 * A song of the story: a tavern song, a hymn, a lullaby. Its words are written as a lead sheet - the
 * lyrics with the chords in square brackets and the sections marked - in a plain subset of ChordPro
 * (`music/chordpro.ts`), so the text reads without the app and travels to any other that knows it.
 *
 * Kept in separate columns and not as one document: a device that edits the lyrics and another that
 * edits the melody never contest the same field, and the text is what search reads.
 */
export interface Song {
  id: string;
  storyId: string;
  title: string;
  /** What the song is for: who sings it, the culture it comes from, its meter and rhyme. */
  notes: string | null;
  /**
   * What is sung, in whatever language: ChordPro text with the chords, the sections and the writer's
   * marks. Melody, karaoke and the syllable counter follow this text.
   */
  lyrics: string;
  /**
   * The lyrics in the language of the reader, for a song sung in another (a made-up one, say): plain
   * lines under the same section marks, with no chords. Only ever read, never sung.
   */
  lyricsTranslation: string | null;
  /** The notes of the tune, as text; empty until the melody is written (see `music/melody.ts`). */
  melody: string | null;
  /** `G`, `Em`, `Bb`: the key the chords are written in. */
  key: string | null;
  /** Beats a minute. */
  tempo: number | null;
  /** `3/4`, `6/8`: the beats in a bar and the note that gets one. */
  meter: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
