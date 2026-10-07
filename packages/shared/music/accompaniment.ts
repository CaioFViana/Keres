import { chordIntervals, parseChord } from './chords';
import { parseMeter } from './songStats';
import type { TimelineChord } from './timeline';

/**
 * The chords of a song as something a harp, a guitar, a piano or a violin plays: which notes, when,
 * and how hard. The chords themselves and where they fall come from the words (`buildTimeline`); this
 * decides only what to do with them, and does it in the plainest way each feel allows - a waltz is
 * a bass note and two stabs, a lullaby a slow rocking arpeggio.
 */
export const INSTRUMENTS = ['guitar', 'harp', 'piano', 'violin'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export const FEELS = ['waltz', 'ballad', 'march', 'lullaby'] as const;
export type Feel = (typeof FEELS)[number];

export interface BackingNote {
  /** MIDI pitch. */
  pitch: number;
  /** Quarter notes from the start of the song. */
  start: number;
  duration: number;
  /** How hard it is played, 0..1. */
  velocity: number;
}

/** The feel a meter suggests: three beats waltz, six eighths rock, two march and four tell a story. */
export function defaultFeel(meter: string | null | undefined): Feel {
  const { beats, unit } = parseMeter(meter);
  if (unit === 8 && beats % 3 === 0 && beats >= 6) return 'lullaby';
  if (beats === 3) return 'waltz';
  if (beats === 2) return 'march';
  return 'ballad';
}

export interface Voicing {
  /** The bass note, low. */
  bass: number;
  /** The fifth above it, for the bass that alternates. */
  fifth: number;
  /** The notes of the chord in close position around the middle of the keyboard, lowest first. */
  tones: number[];
}

/** The notes of a chord symbol as played, or `null` for a mark that is no chord (`N.C.`). */
export function voicing(symbol: string): Voicing | null {
  const chord = parseChord(symbol);
  if (!chord) return null;
  // The root lands between G3 and F#4, so every chord sits in the same hand whatever its key.
  const root = 60 + ((chord.rootPitch + 5) % 12) - 5;
  const bass = 36 + (chord.bassPitch ?? chord.rootPitch);
  return {
    bass,
    fifth: bass + 7,
    tones: chordIntervals(chord.suffix).map((interval) => root + interval),
  };
}

export interface BackingOptions {
  instrument: Instrument;
  feel: Feel;
  meter: string;
}

interface Hit {
  /** Quarter notes after the chord begins. */
  at: number;
  /** Which note: the bass, the bass's fifth, or the n-th tone of the chord (or all, `'chord'`). */
  what: 'bass' | 'fifth' | 'chord' | number;
  duration: number;
  velocity: number;
}

const BASS = 0.85;
const STAB = 0.55;
const SOFT = 0.5;

/** One bar of a feel: when each part is played, in quarter notes. */
function pattern(feel: Feel, barBeats: number): { length: number; hits: Hit[] } {
  switch (feel) {
    case 'waltz':
      return {
        length: 3,
        hits: [
          { at: 0, what: 'bass', duration: 1, velocity: BASS },
          { at: 1, what: 'chord', duration: 1, velocity: STAB },
          { at: 2, what: 'chord', duration: 1, velocity: STAB },
        ],
      };
    case 'march': {
      const beats = barBeats >= 4 ? 4 : 2;
      const hits: Hit[] = [];
      for (let beat = 0; beat < beats; beat += 1) {
        const down = beat % 2 === 0;
        hits.push({
          at: beat,
          what: down ? (beat === 0 ? 'bass' : 'fifth') : 'chord',
          duration: 1,
          velocity: down ? BASS : STAB,
        });
      }
      return { length: beats, hits };
    }
    case 'lullaby': {
      // Six eighths: the bass, then the chord rocking up and back.
      const rocking: Array<'bass' | number> = ['bass', 0, 1, 2, 1, 0];
      return {
        length: 3,
        hits: rocking.map((what, index) => ({
          at: index * 0.5,
          what,
          duration: 1.5,
          velocity: index === 0 ? BASS : SOFT,
        })),
      };
    }
    default: {
      // Eight eighths: a bass on the first and third beats, the chord running up and down between.
      const running = [0, 1, 2, 1, 0, 1];
      const hits: Hit[] = [];
      let step = 0;
      for (let eighth = 0; eighth < 8; eighth += 1) {
        if (eighth === 0) hits.push({ at: 0, what: 'bass', duration: 2, velocity: BASS });
        else if (eighth === 4) hits.push({ at: 2, what: 'fifth', duration: 2, velocity: BASS });
        else {
          hits.push({
            at: eighth * 0.5,
            what: running[step % running.length],
            duration: 1.5,
            velocity: SOFT,
          });
          step += 1;
        }
      }
      return { length: 4, hits };
    }
  }
}

/** The pause between the notes of a chord played one after another, in quarter notes. */
const ROLL: Record<Instrument, number> = { guitar: 0.04, harp: 0.09, piano: 0, violin: 0 };

/**
 * What the instrument plays for each chord of the timeline. A violin ignores the feel and holds the
 * chord; the others play the feel's bar over and over for as long as the chord lasts, never past it.
 */
export function buildBacking(
  chords: readonly TimelineChord[],
  options: BackingOptions,
): BackingNote[] {
  const notes: BackingNote[] = [];
  const barBeats = (parseMeter(options.meter).beats * 4) / parseMeter(options.meter).unit;
  const bar = pattern(options.feel, barBeats);
  const roll = ROLL[options.instrument];

  for (const chord of chords) {
    const played = voicing(chord.symbol);
    if (!played) continue;
    const length = chord.end - chord.start;

    if (options.instrument === 'violin') {
      for (const pitch of played.tones.slice(0, 3)) {
        notes.push({ pitch, start: chord.start, duration: length, velocity: 0.6 });
      }
      continue;
    }

    for (let barStart = 0; barStart < length - 1e-9; barStart += bar.length) {
      for (const hit of bar.hits) {
        const at = barStart + hit.at;
        if (at >= length - 1e-9) continue;
        const duration = Math.min(hit.duration, length - at);
        const start = chord.start + at;
        if (hit.what === 'bass' || hit.what === 'fifth') {
          notes.push({
            pitch: hit.what === 'bass' ? played.bass : played.fifth,
            start,
            duration,
            velocity: hit.velocity,
          });
        } else if (hit.what === 'chord') {
          played.tones.forEach((pitch, index) => {
            notes.push({ pitch, start: start + index * roll, duration, velocity: hit.velocity });
          });
        } else {
          const pitch = played.tones[hit.what % played.tones.length];
          notes.push({ pitch, start, duration, velocity: hit.velocity });
        }
      }
    }
  }
  return notes.filter((note) => note.duration > 0);
}
