/** The key range the editor can reach, in MIDI: C2 to C7, five octaves. */
export const PIANO_LOWEST = 36;
export const PIANO_HIGHEST = 96;
/** A key never gets narrower than this when the keyboard grows with its room. */
const MIN_KEY = 40;
/** The width of a key on a narrow screen, where the keyboard is slid sideways instead. */
export const COMPACT_KEY = 42;
const COMPACT_OCTAVES = 2;
const COMPACT_HEIGHT = 112;
const MAX_HEIGHT = 200;

export interface PianoLayout {
  octaves: number;
  keyWidth: number;
  height: number;
}

/**
 * How the keyboard fills the room it has. Where two octaves of ordinary keys fit with room to spare,
 * the keyboard takes as many octaves as fit at a comfortable key and stretches them to the full
 * width, taller as the keys get wider; narrower than that it stays at two octaves to slide across.
 * `width` is unknown (null/0) until the first layout, which also gives the narrow form.
 */
export function pianoLayout(width: number | null | undefined): PianoLayout {
  const compact = { octaves: COMPACT_OCTAVES, keyWidth: COMPACT_KEY, height: COMPACT_HEIGHT };
  if (!width || width < (COMPACT_OCTAVES * 7 + 1) * COMPACT_KEY) return compact;

  const reachable = (PIANO_HIGHEST - PIANO_LOWEST) / 12;
  const fits = Math.floor((width / MIN_KEY - 1) / 7);
  const octaves = Math.max(COMPACT_OCTAVES, Math.min(reachable, fits));
  const keyWidth = width / (octaves * 7 + 1);
  const height = Math.round(Math.min(MAX_HEIGHT, Math.max(COMPACT_HEIGHT, keyWidth * 3.4)));
  return { octaves, keyWidth, height };
}

/** The highest first key that still leaves room for `octaves` octaves under the top of the range. */
export function highestBase(octaves: number): number {
  return PIANO_HIGHEST - octaves * 12;
}

/** Keeps the first key on a C inside the reachable range for the octaves shown. */
export function clampBase(base: number, octaves: number): number {
  return Math.min(highestBase(octaves), Math.max(PIANO_LOWEST, base));
}

/** Where the keyboard first opens: two octaves from middle C, and more octaves centred on it. */
export function defaultBase(octaves: number): number {
  return octaves <= 2 ? 60 : 60 - 12 * Math.floor((octaves - 1) / 2);
}
