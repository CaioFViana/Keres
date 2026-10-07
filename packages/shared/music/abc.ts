import { type ParsedSong, lyricText, SYLLABLE_MARK } from './chordpro';
import { lineSyllables, type Melody, type MelodyNote, noteToken, resolveMelodies } from './melody';
import { quarterBeatsPerBar } from './songStats';
import type { SyllableLanguage } from './syllables';

export interface AbcOptions {
  title: string;
  key: string | null;
  tempo: number | null;
  meter: string | null;
  language: SyllableLanguage;
  /** Spell black keys with flats. */
  preferFlats: boolean;
}

/** A note that crosses a bar line is written as two tied; the pieces of one, with the bar between. */
function barredTokens(
  note: MelodyNote,
  position: number,
  barBeats: number,
  preferFlats: boolean,
): { text: string; end: number } {
  const parts: string[] = [];
  let at = position;
  let remaining = note.duration;
  while (remaining > 1e-9) {
    const room = barBeats - (at % barBeats || 0);
    const space = room < 1e-9 ? barBeats : room;
    const take = Math.min(remaining, space);
    const more = remaining - take > 1e-9;
    parts.push(
      `${noteToken(note.pitch, take, preferFlats)}${more && note.pitch !== null ? '-' : ''}`,
    );
    at += take;
    remaining -= take;
    if (Math.abs(at / barBeats - Math.round(at / barBeats)) < 1e-9 && remaining > 1e-9) {
      parts.push('|');
    }
  }
  return { text: parts.join(' '), end: at };
}

/**
 * The tune and the words as an ABC file, which any ABC program reads and prints as a score. The
 * words go under the notes in `w:` lines, one per line of the lyrics; where the writer marked the
 * syllables (`·`) they are split there, and elsewhere a word stays whole - so the alignment is exact
 * for a song whose syllables are marked and a best effort for the rest.
 */
export function writeAbc(song: ParsedSong, melody: Melody, options: AbcOptions): string {
  const meter = melody.header.meter ?? options.meter ?? '4/4';
  const tempo = melody.header.tempo ?? options.tempo ?? song.meta.tempo ?? 90;
  const barBeats = quarterBeatsPerBar(meter);
  const out = [
    'X:1',
    `T:${options.title}`,
    `M:${meter}`,
    'L:1/4',
    `Q:1/4=${tempo}`,
    `K:${melody.header.key ?? options.key ?? song.meta.key ?? 'C'}`,
  ];

  for (const entry of resolveMelodies(song, melody, options.language)) {
    const tune = entry.melody;
    if (!tune) continue;
    const section = song.sections[entry.sectionIndex];
    out.push(`P:${entry.label ?? ''}`);
    const lines = section.lines.flatMap((line) => (line.kind === 'lyric' ? [line] : []));
    const counts = lineSyllables(section, options.language);
    const sizeOf = new Map<number, number>();
    for (const note of tune.notes) {
      if (note.syllable !== null) sizeOf.set(note.syllable, (sizeOf.get(note.syllable) ?? 0) + 1);
    }

    let position = 0;
    let first = 0;
    let index = 0;
    const emit = (until: number) => {
      const tokens: string[] = [];
      while (index < tune.notes.length) {
        const note = tune.notes[index];
        if (note.syllable !== null && note.syllable >= until) break;
        const grouped = note.syllable !== null && (sizeOf.get(note.syllable) ?? 0) > 1;
        if (grouped && !note.carries) tokens.push('(');
        const { text, end } = barredTokens(note, position, barBeats, options.preferFlats);
        tokens.push(text);
        position = end;
        const next = tune.notes[index + 1];
        if (grouped && (!next || next.syllable !== note.syllable)) tokens.push(')');
        if (Math.abs(position / barBeats - Math.round(position / barBeats)) < 1e-9)
          tokens.push('|');
        index += 1;
      }
      return tokens.join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
    };

    lines.forEach((line, lineIndex) => {
      const count = counts[lineIndex];
      if (count === 0) return;
      first += count;
      const music = emit(first);
      if (music.trim() === '') return;
      out.push(music);
      const words = lyricText(line.segments, true)
        .trim()
        .split(/\s+/)
        .map((word) => word.split(SYLLABLE_MARK).join('-'))
        .join(' ');
      out.push(`w: ${words}`);
    });
    // Notes left over after the last line of words still belong to the section.
    const leftover = emit(Number.POSITIVE_INFINITY);
    if (leftover.trim() !== '') out.push(leftover);
  }
  return `${out.join('\n')}\n`;
}
