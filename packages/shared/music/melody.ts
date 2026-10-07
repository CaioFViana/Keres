import { NOTE_NAMES_FLAT, NOTE_NAMES_SHARP } from './chords';
import type { ParsedSong, SongSection, SongSectionKind } from './chordpro';
import { lyricText } from './chordpro';
import { quarterBeatsPerBar } from './songStats';
import { countLineSyllables, type SyllableLanguage } from './syllables';

/**
 * The tune of a song, as text.
 *
 * The notation is a closed subset of ABC, so what the writer keeps is readable without the app and
 * opens in any program that knows ABC: `C D E2 | z F/2 G/2 A3/2 -`. A letter is a note (`C` is the
 * middle C, `c` the octave above, `'` raises and `,` lowers an octave), `^` and `_` are a sharp and
 * a flat on that note alone, a number or fraction after it is its length in units of `L:` (a quarter
 * note unless the text says otherwise), `z` is a rest, `-` ties a note to the next of the same pitch,
 * and `( )` put several notes on one syllable. Bars (`|`) are only for the eye.
 *
 * It is stored **once per section**: a `P:Verse 1` line starts the tune of that section, and a
 * section of the lyrics that has no tune of its own sings the one of the section of its kind before
 * it. A ballad of seventy-eight stanzas is one tune, not seventy-eight (see `resolveMelodies`).
 * The tune is not tied to the words by position: notes meet syllables by order, and a section where
 * their numbers differ is reported rather than refused - syllables are only ever estimated.
 */
export interface MelodyHeader {
  meter: string | null;
  tempo: number | null;
  key: string | null;
  /** The note an unmarked length means, in quarter notes (`L:1/8` is 0.5). */
  unit: number;
}

export interface MelodyNote {
  /** MIDI pitch (middle C is 60); `null` for a rest. */
  pitch: number | null;
  /** Quarter notes from the start of its section. */
  start: number;
  /** Quarter notes. */
  duration: number;
  /**
   * The syllable this note sings: the n-th of its section, counting a slurred group as one. A rest sings none.
   */
  syllable: number | null;
  /** The note is the second or later of a slurred group: it sings the syllable its group began. */
  carries: boolean;
}

export interface MelodySection {
  /** The lyrics section the tune is for; `null` before any `P:` line (the tune of any verse). */
  label: string | null;
  notes: MelodyNote[];
  /** Syllables sung: the groups of notes, not the notes. */
  syllables: number;
  /** Quarter notes from the start to the end of the last note. */
  length: number;
}

export interface MelodyError {
  /** 1-based line of the text. */
  line: number;
  token: string;
  reason: 'unknown-token' | 'unclosed-slur' | 'stray-slur' | 'tie-to-nothing';
}

export interface Melody {
  header: MelodyHeader;
  sections: MelodySection[];
  errors: MelodyError[];
}

const DEFAULT_UNIT = 1;
const NATURAL_PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const HEADER_LINE = /^\s*([MQKLPTX]):\s*(.*?)\s*$/;
const TOKEN =
  /\s*(?:(\|\]|\|\||\[\||:\||\|:|\|)|(\()|(\))|(z|x)(\d*(?:\/\d*)?)|([_^=]{0,2})([A-Ga-g])([',]*)(\d*(?:\/\d*)?)(-?))/y;

/** `3`, `/2`, `3/2`, `/` as a multiple of the unit. */
export function parseLength(text: string): number {
  if (text === '') return 1;
  const slash = text.indexOf('/');
  if (slash < 0) return Number(text);
  const top = text.slice(0, slash);
  const bottom = text.slice(slash + 1);
  return (top === '' ? 1 : Number(top)) / (bottom === '' ? 2 : Number(bottom));
}

function parseUnit(value: string): number | null {
  const match = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(value);
  if (!match || Number(match[1]) === 0 || Number(match[2]) === 0) return null;
  return (4 * Number(match[1])) / Number(match[2]);
}

function accidentalOf(marks: string): number {
  if (marks.includes('=')) return 0;
  return [...marks].reduce((sum, mark) => sum + (mark === '^' ? 1 : mark === '_' ? -1 : 0), 0);
}

function pitchOf(accidental: string, letter: string, octaves: string): number {
  const upper = letter === letter.toUpperCase();
  const octave =
    4 + (upper ? 0 : 1) + [...octaves].reduce((sum, mark) => sum + (mark === "'" ? 1 : -1), 0);
  return 12 * (octave + 1) + NATURAL_PITCH[letter.toUpperCase()] + accidentalOf(accidental);
}

/**
 * Reads the text into its sections of notes. Never throws: a token it cannot read is skipped and
 * listed in `errors`, so a tune being typed always plays as far as it is written.
 */
export function parseMelody(text: string): Melody {
  const header: MelodyHeader = { meter: null, tempo: null, key: null, unit: DEFAULT_UNIT };
  const sections: MelodySection[] = [];
  const errors: MelodyError[] = [];

  let current: MelodySection | null = null;
  let position = 0;
  let groupOpen = false;
  let groupLine = 0;
  let syllable = -1;
  let tiedTo: number | null = null;
  let tieLine = 0;

  const closeSection = () => {
    if (groupOpen && current) {
      errors.push({ line: groupLine, token: '(', reason: 'unclosed-slur' });
    }
    if (tiedTo !== null && current) {
      errors.push({ line: tieLine, token: '-', reason: 'tie-to-nothing' });
    }
    groupOpen = false;
    tiedTo = null;
  };
  const open = (label: string | null) => {
    closeSection();
    current = { label, notes: [], syllables: 0, length: 0 };
    sections.push(current);
    position = 0;
    syllable = -1;
  };

  text.split(/\r?\n/).forEach((raw, index) => {
    const lineNumber = index + 1;
    const line = raw.replace(/%.*$/, '');
    if (line.trim() === '') return;
    const field = HEADER_LINE.exec(line);
    if (field) {
      const [, name, value] = field;
      if (name === 'P') {
        open(value === '' ? null : value);
        return;
      }
      if (name === 'M') header.meter = value || null;
      else if (name === 'Q') {
        const tempo = Number(/(\d{1,3})\s*$/.exec(value)?.[1]);
        header.tempo = Number.isFinite(tempo) && tempo > 0 ? tempo : null;
      } else if (name === 'K') header.key = value || null;
      else if (name === 'L') header.unit = parseUnit(value) ?? header.unit;
      return;
    }

    TOKEN.lastIndex = 0;
    let rest = line;
    while (rest.trim() !== '') {
      const match = TOKEN.exec(rest);
      if (!match) {
        const bad = /\S+/.exec(rest)?.[0] ?? rest;
        errors.push({ line: lineNumber, token: bad, reason: 'unknown-token' });
        rest = rest.slice(rest.indexOf(bad) + bad.length);
        TOKEN.lastIndex = 0;
        continue;
      }
      rest = rest.slice(match[0].length);
      TOKEN.lastIndex = 0;
      if (match[1]) continue;
      if (!current) open(null);
      const section: MelodySection = current as MelodySection;

      if (match[2]) {
        if (groupOpen) errors.push({ line: lineNumber, token: '(', reason: 'stray-slur' });
        groupOpen = true;
        groupLine = lineNumber;
        syllable += 1;
        section.syllables += 1;
        continue;
      }
      if (match[3]) {
        if (!groupOpen) errors.push({ line: lineNumber, token: ')', reason: 'stray-slur' });
        groupOpen = false;
        continue;
      }

      const duration = parseLength(match[5] ?? match[9] ?? '') * header.unit;
      // A tie is kept only by a note of the same pitch right after it.
      const pendingTie = tiedTo;
      tiedTo = null;
      if (match[4]) {
        if (pendingTie !== null) {
          errors.push({ line: tieLine, token: '-', reason: 'tie-to-nothing' });
        }
        section.notes.push({
          pitch: null,
          start: position,
          duration,
          syllable: null,
          carries: false,
        });
        position += duration;
        section.length = position;
        continue;
      }

      const pitch = pitchOf(match[6], match[7], match[8]);
      if (pendingTie !== null && section.notes[pendingTie]?.pitch === pitch) {
        // A tie lengthens the note before it; the two sing one syllable and make one event.
        section.notes[pendingTie].duration += duration;
      } else {
        if (pendingTie !== null) {
          errors.push({ line: tieLine, token: '-', reason: 'tie-to-nothing' });
        }
        const continues = groupOpen && section.notes.some((n) => n.syllable === syllable);
        if (!groupOpen) {
          syllable += 1;
          section.syllables += 1;
        }
        section.notes.push({ pitch, start: position, duration, syllable, carries: continues });
      }
      position += duration;
      section.length = position;
      if (match[10]) {
        tiedTo = section.notes.length - 1;
        tieLine = lineNumber;
      }
    }
  });
  closeSection();
  return { header, sections, errors };
}

/** The pitch's name as ABC spells it: `C`, `^F`, `_B,`, `c'`. */
export function abcNoteName(pitch: number, preferFlats: boolean): string {
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const pitchClass = ((pitch % 12) + 12) % 12;
  const name = names[pitchClass];
  const octave = Math.floor(pitch / 12) - 1;
  const accidental = name.length > 1 ? (name[1] === '#' ? '^' : '_') : '';
  const letter = name[0];
  if (octave >= 5) return `${accidental}${letter.toLowerCase()}${"'".repeat(octave - 5)}`;
  return `${accidental}${letter}${','.repeat(4 - octave)}`;
}

/** `C4`, `F#3`, `Bb4`: the name a person reads on a key. */
export function pitchLabel(pitch: number, preferFlats = false): string {
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return `${names[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

const GCD = (a: number, b: number): number => (b === 0 ? a : GCD(b, a % b));

/** The length of a note as the text writes it: `` for one unit, `2`, `/2`, `3/2`. */
export function lengthToken(beats: number, unit = DEFAULT_UNIT): string {
  const multiple = beats / unit;
  if (Number.isInteger(multiple)) return multiple === 1 ? '' : String(multiple);
  for (const denominator of [2, 3, 4, 6, 8, 12, 16]) {
    const numerator = Math.round(multiple * denominator);
    if (numerator > 0 && Math.abs(numerator / denominator - multiple) < 1e-6) {
      const divisor = GCD(numerator, denominator);
      const top = numerator / divisor;
      const bottom = denominator / divisor;
      return top === 1 ? `/${bottom}` : `${top}/${bottom}`;
    }
  }
  return `${Math.max(1, Math.round(multiple * 16))}/16`;
}

/** One note, or a rest (`pitch` `null`), as text. */
export function noteToken(
  pitch: number | null,
  beats: number,
  preferFlats = false,
  unit = DEFAULT_UNIT,
): string {
  return `${pitch === null ? 'z' : abcNoteName(pitch, preferFlats)}${lengthToken(beats, unit)}`;
}

/**
 * The text with every note moved by `semitones`, respelled in sharps or flats. Only music lines move:
 * field lines (`P:`, `K:`) and comments stay as written, and the key is moved by the caller with the
 * chords, so the tune and the chords never part.
 */
export function transposeMelody(text: string, semitones: number, preferFlats: boolean): string {
  if (semitones === 0) return text;
  return text
    .split(/(\r?\n)/)
    .map((line) => {
      if (/^\s*[A-Z]:/.test(line) || /^\s*%/.test(line)) return line;
      return line.replace(
        /([_^=]{0,2})([A-Ga-g])([',]*)(\d*(?:\/\d*)?)(-?)/g,
        (_all, accidental, letter, octaves, length, tie) =>
          `${abcNoteName(pitchOf(accidental, letter, octaves) + semitones, preferFlats)}${length}${tie}`,
      );
    })
    .join('');
}

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
