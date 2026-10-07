import { readDirective } from './chordpro';

/** The twelve pitch classes, spelled with sharps and with flats. */
export const NOTE_NAMES_SHARP = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;
export const NOTE_NAMES_FLAT = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A chord as it is written: the root, what is said after it (`m7`, `sus4`...), and a bass note if any. */
export interface ParsedChord {
  root: string;
  rootPitch: number;
  suffix: string;
  bass: string | null;
  bassPitch: number | null;
}

const mod12 = (value: number) => ((value % 12) + 12) % 12;

/** The pitch class of a note name (`F#`, `Bb`, `E#`), or `null` when it is not one. */
export function pitchOfName(name: string): number | null {
  const match = /^([A-Ga-g])([#b]?)$/.exec(name.trim());
  if (!match) return null;
  const natural = NATURAL[match[1].toUpperCase()];
  return mod12(natural + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0));
}

// What may follow a root: the letters and signs chords use, so that a word between brackets is not one.
const CHORD_SUFFIX = /^[mMajinsudgo+\-Δø\d#b(),]*$/;
const CHORD = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;

/** Reads a chord symbol; `null` for anything that is not one (`N.C.`, a word between brackets). */
export function parseChord(symbol: string): ParsedChord | null {
  const match = CHORD.exec(symbol.trim());
  if (!match || !CHORD_SUFFIX.test(match[2])) return null;
  const rootPitch = pitchOfName(match[1]);
  if (rootPitch === null) return null;
  const bassPitch = match[3] ? pitchOfName(match[3]) : null;
  return {
    root: match[1],
    rootPitch,
    suffix: match[2],
    bass: match[3] ?? null,
    bassPitch,
  };
}

const spell = (pitch: number, preferFlats: boolean) =>
  (preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[mod12(pitch)];

/** Whether a key is spelled with flats: F, Bb, Eb... and their minors (`Dm`, `Gm`, `Cm`...). */
export function keyPrefersFlats(key: string): boolean {
  const match = /^([A-G])([#b]?)(m|min|minor)?/.exec(key.trim());
  if (!match) return false;
  if (match[2] === 'b') return true;
  if (match[2] === '#') return false;
  const minor = Boolean(match[3]);
  return minor ? ['D', 'G', 'C', 'F'].includes(match[1]) : match[1] === 'F';
}

/** The chord moved by `semitones`; a symbol that is not a chord comes back as it was. */
export function transposeChord(symbol: string, semitones: number, preferFlats: boolean): string {
  const chord = parseChord(symbol);
  if (!chord) return symbol;
  const root = spell(chord.rootPitch + semitones, preferFlats);
  const bass =
    chord.bassPitch === null ? '' : `/${spell(chord.bassPitch + semitones, preferFlats)}`;
  return `${root}${chord.suffix}${bass}`;
}

/** A key (`G`, `Em`, `F#m`, `Bb`) moved by `semitones`; whatever is not one comes back as it was. */
export function transposeKey(key: string, semitones: number, preferFlats: boolean): string {
  const match = /^([A-G][#b]?)(.*)$/.exec(key.trim());
  if (!match) return key;
  const pitch = pitchOfName(match[1]);
  if (pitch === null) return key;
  return `${spell(pitch + semitones, preferFlats)}${match[2]}`;
}

/**
 * The lyrics with every chord moved by `semitones`, and the `{key: ...}` if the text carries one. The
 * words are never touched. `preferFlats` is the spelling of the key moved to.
 */
export function transposeLyrics(text: string, semitones: number, preferFlats: boolean): string {
  if (semitones % 12 === 0) return text;
  return text
    .split(/(\r?\n)/)
    .map((line) => {
      if (line.trim().startsWith('#')) return line;
      const directive = readDirective(line);
      if (directive) {
        return directive.name === 'key'
          ? `{key: ${transposeKey(directive.value, semitones, preferFlats)}}`
          : line;
      }
      return line.replace(/\[([^\]]*)\]/g, (_all, inner: string) => {
        const moved = transposeChord(inner.trim(), semitones, preferFlats);
        return `[${moved}]`;
      });
    })
    .join('');
}

/** Intervals above the root for what a chord's suffix says; a plain triad when it says nothing known. */
export function chordIntervals(suffix: string): number[] {
  const s = suffix.trim();
  const table: Array<[RegExp, number[]]> = [
    [/^(maj7|M7|Δ|Δ7)/, [0, 4, 7, 11]],
    [/^(m7b5|ø)/, [0, 3, 6, 10]],
    [/^(dim7|o7)/, [0, 3, 6, 9]],
    [/^(dim|o)/, [0, 3, 6]],
    [/^(aug|\+)/, [0, 4, 8]],
    [/^(m|min|-)(maj7|M7)/, [0, 3, 7, 11]],
    [/^(m|min|-)7/, [0, 3, 7, 10]],
    [/^(m|min|-)6/, [0, 3, 7, 9]],
    [/^(m|min|-)9/, [0, 3, 7, 10, 14]],
    [/^(m|min|-)/, [0, 3, 7]],
    [/^sus2/, [0, 2, 7]],
    [/^sus4?/, [0, 5, 7]],
    [/^add9/, [0, 4, 7, 14]],
    [/^(maj9|M9)/, [0, 4, 7, 11, 14]],
    [/^9/, [0, 4, 7, 10, 14]],
    [/^7/, [0, 4, 7, 10]],
    [/^6/, [0, 4, 7, 9]],
    [/^5/, [0, 7]],
  ];
  for (const [pattern, intervals] of table) if (pattern.test(s)) return intervals;
  return [0, 4, 7];
}
