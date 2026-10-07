import { chordsOf, lyricText, parseChordPro } from './chordpro';
import { countLineSyllables, type SyllableLanguage } from './syllables';

export const DEFAULT_TEMPO = 90;
export const DEFAULT_METER = '4/4';

/** `3/4` as its beats per bar and the note that gets a beat; anything else is read as 4/4. */
export function parseMeter(meter: string | null | undefined): { beats: number; unit: number } {
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(meter ?? '');
  if (!match) return { beats: 4, unit: 4 };
  const beats = Number(match[1]);
  const unit = Number(match[2]);
  if (beats < 1 || ![1, 2, 4, 8, 16].includes(unit)) return { beats: 4, unit: 4 };
  return { beats, unit };
}

/** Beats of a quarter note in a bar: 6/8 is three of them. */
export function quarterBeatsPerBar(meter: string | null | undefined): number {
  const { beats, unit } = parseMeter(meter);
  return (beats * 4) / unit;
}

export interface SongLengthInput {
  lyrics: string;
  tempo: number | null;
  meter: string | null;
}

export interface SongLengthEstimate {
  bars: number;
  seconds: number;
}

/**
 * How long the song runs, roughly: each chord is a bar (the app's own rule when there is no melody),
 * and a song with no chords is taken at two bars a line. An estimate to plan a scene with; a melody
 * will say it exactly.
 */
export function estimateSongLength(input: SongLengthInput): SongLengthEstimate {
  const chords = chordsOf(input.lyrics).length;
  const lines = parseChordPro(input.lyrics).sections.reduce(
    (sum, section) => sum + section.lines.filter((line) => line.kind === 'lyric').length,
    0,
  );
  const bars = chords > 0 ? chords : lines * 2;
  const tempo = input.tempo && input.tempo > 0 ? input.tempo : DEFAULT_TEMPO;
  const seconds = (bars * quarterBeatsPerBar(input.meter) * 60) / tempo;
  return { bars, seconds: Math.round(seconds) };
}

/** Syllables of each lyric line of the text, in order, with the plain line they were counted from. */
export function syllableCounts(
  lyrics: string,
  language: SyllableLanguage,
): Array<{ text: string; syllables: number }> {
  const result: Array<{ text: string; syllables: number }> = [];
  for (const section of parseChordPro(lyrics).sections) {
    for (const line of section.lines) {
      if (line.kind !== 'lyric') continue;
      const text = lyricText(line.segments, true);
      if (text.trim() === '') continue;
      result.push({
        text: lyricText(line.segments),
        syllables: countLineSyllables(text, language),
      });
    }
  }
  return result;
}
