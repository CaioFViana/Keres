import { NOTE_NAMES_FLAT, NOTE_NAMES_SHARP } from './chords';

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

const SECTION_LINE = /^\s*P:\s*(.*?)\s*$/;
const FIELD_LINE = /^\s*[MQKLPTX]:/;

/** Where the section of a label begins and ends among the lines of the text (`null`: not there). */
function sectionSpan(lines: readonly string[], label: string | null): [number, number] | null {
  const marks = lines.flatMap((line, index) => {
    const match = SECTION_LINE.exec(line);
    return match ? [{ index, label: match[1] === '' ? null : match[1] }] : [];
  });
  if (label === null) {
    // The tune with no label is whatever stands before the first `P:` line.
    const end = marks.length > 0 ? marks[0].index : lines.length;
    const hasMusic = lines.slice(0, end).some((line) => line.trim() !== '' && !FIELD_LINE.test(line));
    return hasMusic || marks.length === 0 ? [0, end] : null;
  }
  const at = marks.findIndex((mark) => mark.label === label);
  if (at < 0) return null;
  return [marks[at].index + 1, at + 1 < marks.length ? marks[at + 1].index : lines.length];
}

/**
 * The text with a note (or rest) token added at the end of the section's tune, as the keyboard does.
 * A section that is not in the text yet gets its `P:` line.
 */
export function appendNote(text: string, label: string | null, token: string): string {
  const lines = text === '' ? [] : text.replace(/\r\n/g, '\n').split('\n');
  const span = sectionSpan(lines, label);
  if (!span && label === null) {
    // The tune with no label goes before the first labelled one, or it would join the last of them.
    const firstMark = lines.findIndex((line) => SECTION_LINE.test(line));
    lines.splice(firstMark < 0 ? lines.length : firstMark, 0, token);
    return lines.join('\n');
  }
  if (!span) {
    const head = label === null ? [] : [`P:${label}`];
    const body = lines.length > 0 && lines[lines.length - 1].trim() === '' ? lines.slice(0, -1) : lines;
    return [...body, ...head, token].join('\n');
  }
  const [from, to] = span;
  for (let index = to - 1; index >= from; index -= 1) {
    const line = lines[index];
    if (line.trim() === '' || FIELD_LINE.test(line) || /^\s*%/.test(line)) continue;
    lines[index] = `${line.replace(/\s+$/, '')} ${token}`;
    return lines.join('\n');
  }
  lines.splice(to, 0, token);
  return lines.join('\n');
}

/** The text without the last note, rest or slur mark of the section's tune: the keyboard's backspace. */
export function removeLastNote(text: string, label: string | null): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const span = sectionSpan(lines, label);
  if (!span) return text;
  const [from, to] = span;
  for (let index = to - 1; index >= from; index -= 1) {
    const line = lines[index];
    if (line.trim() === '' || FIELD_LINE.test(line) || /^\s*%/.test(line)) continue;
    const tokens = line.trim().split(/\s+/);
    while (tokens.length > 0 && /^(\||\|\]|\|\||\[\||:\||\|:)$/.test(tokens[tokens.length - 1])) tokens.pop();
    tokens.pop();
    if (tokens.length === 0) lines.splice(index, 1);
    else lines[index] = tokens.join(' ');
    return lines.join('\n');
  }
  return text;
}
