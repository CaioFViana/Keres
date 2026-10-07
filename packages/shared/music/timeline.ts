import type { ParsedSong, SongSection, SongSectionKind } from './chordpro';
import { lyricText } from './chordpro';
import type { Melody, MelodyNote, MelodySection } from './melody';
import { quarterBeatsPerBar } from './songStats';
import { countLineSyllables, type SyllableLanguage } from './syllables';

export interface ResolvedMelody {
  /** The lyrics section, in the order the song states them. */
  sectionIndex: number;
  label: string | null;
  kind: SongSectionKind;
  /** The tune it sings, or `null` when none is written for it. */
  melody: MelodySection | null;
  /** The label of the section whose tune it borrows, when it has none of its own. */
  inheritedFrom: string | null;
  /** Syllables the words of the section have, by the estimate. */
  syllables: number;
  /** `short`: fewer notes than syllables; `long`: more. */
  alignment: 'none' | 'match' | 'short' | 'long';
}

const lyricLinesOf = (section: SongSection) =>
  section.lines.flatMap((line) => (line.kind === 'lyric' ? [line] : []));

/** Syllables of each lyric line of a section that has words. */
export function lineSyllables(section: SongSection, language: SyllableLanguage): number[] {
  return lyricLinesOf(section).map((line) =>
    countLineSyllables(lyricText(line.segments, true), language),
  );
}

/**
 * Which tune each section of the lyrics sings. An exact label wins; otherwise the section sings the
 * tune of the last section of its kind that had one (verse after verse), or the unlabelled tune for
 * a verse. A chorus is never given a verse's tune: a song with a chorus and no tune for it has none.
 */
export function resolveMelodies(
  song: ParsedSong,
  melody: Melody,
  language: SyllableLanguage,
): ResolvedMelody[] {
  const byLabel = new Map(
    melody.sections.flatMap((section) =>
      section.label ? [[section.label, section] as const] : [],
    ),
  );
  const fallback = melody.sections.find((section) => section.label === null) ?? null;
  const lastOfKind = new Map<SongSectionKind, { label: string | null; melody: MelodySection }>();

  return song.sections.flatMap((section, sectionIndex) => {
    const syllables = lineSyllables(section, language).reduce((sum, n) => sum + n, 0);
    if (syllables === 0) return [];
    const own = section.label ? (byLabel.get(section.label) ?? null) : null;
    const kind = section.kind;
    const borrowed = own ? null : (lastOfKind.get(kind) ?? null);
    const unlabelled = !own && !borrowed && (kind === 'verse' || kind === 'none') ? fallback : null;
    const chosen = own ?? borrowed?.melody ?? unlabelled;
    if (chosen) lastOfKind.set(kind, { label: section.label, melody: chosen });
    const notes = chosen?.syllables ?? 0;
    return [
      {
        sectionIndex,
        label: section.label,
        kind,
        melody: chosen,
        inheritedFrom: own ? null : (borrowed?.label ?? null),
        syllables,
        alignment: !chosen
          ? 'none'
          : notes === syllables
            ? 'match'
            : notes < syllables
              ? 'short'
              : 'long',
      } satisfies ResolvedMelody,
    ];
  });
}

export interface PlayNote {
  /** MIDI pitch. */
  pitch: number;
  /** Quarter notes from the start of the song. */
  start: number;
  duration: number;
  /** The syllable begins here (a slurred or tied continuation does not). */
  sung: boolean;
}

export interface TimelineLine {
  sectionIndex: number;
  /** The lyric line within its section, counting only lines with words. */
  lineIndex: number;
  /** The same line's place among all the lines of its section (blank lines and comments count). */
  sourceIndex: number;
  text: string;
  start: number;
  end: number;
}

export interface Timeline {
  notes: PlayNote[];
  lines: TimelineLine[];
  /** Quarter notes in all. */
  beats: number;
  tempo: number;
  meter: string;
  seconds: number;
}

export interface TimelineOptions {
  language: SyllableLanguage;
  tempo: number | null;
  meter: string | null;
  /** Play only this section of the lyrics (its index in `song.sections`). */
  onlySection?: number;
  /** Stop after this many seconds. */
  maxSeconds?: number;
}

/** What the song plays: its sections one after another, each starting on a bar line. */
export function buildTimeline(
  song: ParsedSong,
  melody: Melody,
  options: TimelineOptions,
): Timeline {
  const meter = melody.header.meter ?? options.meter ?? '4/4';
  const tempo = melody.header.tempo ?? options.tempo ?? song.meta.tempo ?? 90;
  const barBeats = quarterBeatsPerBar(meter);
  const maxBeats = options.maxSeconds
    ? (options.maxSeconds * tempo) / 60
    : Number.POSITIVE_INFINITY;
  const resolved = resolveMelodies(song, melody, options.language);
  const notes: PlayNote[] = [];
  const lines: TimelineLine[] = [];
  let cursor = 0;

  const chorusRecall = (label: string | null) =>
    resolved.find((entry) => entry.kind === 'chorus' && (label === null || entry.label === label));

  const play = (entry: ResolvedMelody, offset: number) => {
    const section = song.sections[entry.sectionIndex];
    const tune = entry.melody;
    if (!tune) return offset;
    const counts = lineSyllables(section, options.language);
    const spans = lyricLinesOf(section);
    const sourceIndexes = new Map(section.lines.map((line, index) => [line, index]));
    // Each note of the tune is placed; lines take their span from the syllables they hold.
    const firstOfSyllable = new Map<number, MelodyNote>();
    const lastEndOfSyllable = new Map<number, number>();
    for (const note of tune.notes) {
      if (note.pitch === null || note.syllable === null) continue;
      if (!firstOfSyllable.has(note.syllable)) firstOfSyllable.set(note.syllable, note);
      lastEndOfSyllable.set(note.syllable, note.start + note.duration);
      notes.push({
        pitch: note.pitch,
        start: offset + note.start,
        duration: note.duration,
        sung: !note.carries,
      });
    }
    let first = 0;
    spans.forEach((line, lineIndex) => {
      const count = counts[lineIndex];
      if (count === 0) return;
      const from = first;
      first += count;
      // Lines past the last note have nothing to follow: the tune is short of the words.
      if (from >= tune.syllables) return;
      const head = firstOfSyllable.get(from);
      const tail = lastEndOfSyllable.get(Math.min(from + count, tune.syllables) - 1);
      if (!head || tail === undefined) return;
      lines.push({
        sectionIndex: entry.sectionIndex,
        lineIndex,
        sourceIndex: sourceIndexes.get(line) ?? lineIndex,
        text: lyricText(line.segments),
        start: offset + head.start,
        end: offset + tail,
      });
    });
    const end = offset + tune.length;
    return Math.ceil(end / barBeats - 1e-9) * barBeats;
  };

  for (const entry of resolved) {
    if (options.onlySection !== undefined && entry.sectionIndex !== options.onlySection) continue;
    if (cursor >= maxBeats) break;
    cursor = play(entry, cursor);
    // `{chorus}` after a section sings that chorus again.
    const recalls = song.sections[entry.sectionIndex].lines.flatMap((line) =>
      line.kind === 'recall' ? [line] : [],
    );
    for (const recall of recalls) {
      const target = chorusRecall(recall.label);
      if (target && target.sectionIndex !== entry.sectionIndex) cursor = play(target, cursor);
    }
  }

  const clipped = notes.filter((note) => note.start < maxBeats);
  const beats = Math.min(cursor, maxBeats);
  return {
    notes: clipped,
    lines: lines.filter((line) => line.start < maxBeats),
    beats,
    tempo,
    meter,
    seconds: (beats * 60) / tempo,
  };
}
