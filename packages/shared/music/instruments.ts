import type { Instrument } from './accompaniment';

/**
 * The four instruments of the accompaniment, made of arithmetic like the voice. None is a recording
 * and none pretends to be - they are there to give a tune something to stand on, and they are only as
 * good as the simple physics in them:
 *
 * - **Guitar, harp, piano:** a string, as a delay line with a little loss (Karplus-Strong). A plucked
 *   string starts as a burst of noise cut by where it was plucked; a piano string starts as the short
 *   push of a hammer and has two or three strings a hair apart, which is what makes it beat. How long
 *   it rings is set in seconds, whatever the pitch.
 * - **Violin:** a band-limited saw (the bow's stick-and-slip) through a handful of fixed resonances -
 *   the body and the bridge - with the scrape of the bow on top and a vibrato that arrives late.
 *
 * As in the voice, the loops here call nothing and allocate nothing per sample.
 */
export interface InstrumentNote {
  pitch: number;
  /** Seconds. */
  start: number;
  duration: number;
  velocity: number;
}

export interface InstrumentContext {
  sampleRate: number;
  /** The state of the noise generator, carried from note to note. */
  seed: number;
}

const TWO_PI = Math.PI * 2;
const midiHz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

/** How loud each instrument is against the voice (which peaks near 0.5). */
export const INSTRUMENT_GAIN: Record<Instrument, number> = {
  guitar: 0.46,
  harp: 0.34,
  piano: 0.28,
  violin: 0.1,
};

function noiseStep(seed: number): number {
  let state = seed;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state;
}

interface StringModel {
  /** Seconds for the string to fall 60 dB, at any pitch. */
  ring: number;
  /**
   * The weight of the older sample in the average that closes the loop: 0.5 takes the highs out fast,
   * nearer 1 keeps them. A string with a hard, bright start needs it high.
   */
  weight: number;
  /** How the string starts. */
  excite: 'pluck' | 'hammer';
  /** Noise smoothing for a pluck: 1 is white (bright), lower is a soft thumb. */
  brightness: number;
  /** Where on the string it is plucked, as a fraction of its length; 0 for nowhere in particular. */
  pick: number;
  /** Cents each string is off the pitch: one string, or several that beat against each other. */
  detune: readonly number[];
  /** Seconds the string takes to be damped once the player lets go. */
  release: number;
}

const GUITAR: StringModel = {
  ring: 2.2,
  weight: 0.8,
  excite: 'pluck',
  brightness: 0.95,
  pick: 0.17,
  detune: [0],
  release: 0.12,
};
const HARP: StringModel = {
  ring: 3.6,
  weight: 0.9,
  excite: 'pluck',
  brightness: 0.85,
  pick: 0.1,
  detune: [0],
  release: 0.35,
};
const PIANO: StringModel = {
  ring: 4.5,
  weight: 0.92,
  excite: 'hammer',
  brightness: 1,
  pick: 0,
  detune: [-1.4, 1.4],
  release: 0.22,
};

/** One string of a model: fills the delay line, then lets it ring into `out` until it is damped. */
function renderString(
  out: Float32Array,
  note: InstrumentNote,
  context: InstrumentContext,
  model: StringModel,
  cents: number,
  share: number,
) {
  const { sampleRate } = context;
  const hertz = midiHz(note.pitch) * 2 ** (cents / 1200);
  const period = sampleRate / hertz;
  const lag = 1 - model.weight;
  // The loop must delay by one period. Averaging a sample with its newer neighbour shortens the loop
  // by `lag`; what is missing, up to a sample, is made up by an all-pass, so the string is in tune and
  // not merely on a whole number of samples.
  const size = Math.max(2, Math.floor(period + lag - 0.1));
  const extra = Math.max(0.1, period - size + lag);
  const tune = (1 - extra) / (1 + extra);
  const buffer = new Float32Array(size);

  let seed = context.seed;
  if (model.excite === 'pluck') {
    let soft = 0;
    for (let i = 0; i < size; i += 1) {
      seed = noiseStep(seed);
      const noise = (seed | 0) * 4.6566128730773926e-10;
      soft += model.brightness * (noise - soft);
      buffer[i] = soft;
    }
    if (model.pick > 0) {
      // A string plucked a fifth of the way along has no fifth harmonic: the comb takes it out.
      const gap = Math.max(1, Math.round(model.pick * size));
      for (let i = size - 1; i >= gap; i -= 1) buffer[i] -= buffer[i - gap];
    }
  } else {
    // A hammer is a short, soft push; a hard blow is narrower and so brighter.
    const width = Math.max(2, Math.round(size * (0.22 - 0.14 * note.velocity)));
    for (let i = 0; i < width && i < size; i += 1) {
      buffer[i] = 0.5 - 0.5 * Math.cos((TWO_PI * (i + 0.5)) / width);
    }
  }
  context.seed = seed;

  // What is kept of a string is what moves: its average position stays where it was.
  let mean = 0;
  for (let i = 0; i < size; i += 1) mean += buffer[i];
  mean /= size;
  let peak = 0;
  for (let i = 0; i < size; i += 1) {
    buffer[i] -= mean;
    const level = Math.abs(buffer[i]);
    if (level > peak) peak = level;
  }
  const scale = peak > 0 ? (note.velocity * share) / peak : 0;
  for (let i = 0; i < size; i += 1) buffer[i] *= scale;

  // Falling 60 dB in `ring` seconds takes this much off each pass round the loop.
  const decay = 10 ** (-3 / (Math.max(0.2, model.ring) * hertz));
  const first = Math.max(0, Math.round(note.start * sampleRate));
  const body = Math.max(1, Math.round(note.duration * sampleRate));
  const tail = Math.round(model.release * sampleRate);
  const last = Math.min(out.length, first + body + tail);
  const fadeStart = first + body;
  const fadeStep = 1 / Math.max(1, tail);
  const weight = model.weight;
  let at = 0;
  let level = 1;
  let allpassIn = 0;
  let allpassOut = 0;
  for (let i = first; i < last; i += 1) {
    const next = at + 1 === size ? 0 : at + 1;
    const value = buffer[at];
    const averaged = decay * (weight * value + lag * buffer[next]);
    const tuned = tune * averaged + allpassIn - tune * allpassOut;
    allpassIn = averaged;
    allpassOut = tuned;
    buffer[at] = tuned;
    at = next;
    // Let ring until the note ends, then the string is damped over its release.
    if (i >= fadeStart) {
      level -= fadeStep;
      if (level <= 0) break;
    }
    out[i] += value * level;
  }
}

function renderStrings(
  out: Float32Array,
  note: InstrumentNote,
  context: InstrumentContext,
  model: StringModel,
  heavy: number,
) {
  // A low string rings longer than a high one; the model's time is for the middle of the keyboard.
  const ring = model.ring * 2 ** ((60 - note.pitch) / 36);
  const adjusted = { ...model, ring: Math.min(8, Math.max(0.8, ring)) };
  // The strings that beat cost a loop each; a soft note in the middle of an arpeggio does not need them.
  const strings = note.velocity > heavy ? model.detune : model.detune.slice(0, 1);
  for (const cents of strings) {
    renderString(out, note, context, adjusted, cents, 1 / strings.length);
  }
}

// The violin's resonances: the body and the bridge, as band-passes of fixed frequency, with how loud
// each is against the bowed string itself. They stay where they are whatever note is played, which is
// much of what tells a violin from a saw wave.
const BODY = [
  { f: 330, bw: 120, level: 0.6 },
  { f: 1200, bw: 400, level: 0.5 },
  { f: 2800, bw: 900, level: 0.75 },
] as const;

function bandPass(frequency: number, bandwidth: number, level: number, sampleRate: number) {
  const theta = (TWO_PI * frequency) / sampleRate;
  const radius = Math.exp((-Math.PI * bandwidth) / sampleRate);
  const b = 2 * radius * Math.cos(theta);
  const c = -radius * radius;
  const real = 1 - b * Math.cos(theta) - c * Math.cos(2 * theta);
  const imaginary = b * Math.sin(theta) + c * Math.sin(2 * theta);
  return { g: (level * Math.hypot(real, imaginary)) / (2 * Math.abs(Math.sin(theta))), b, c };
}

function renderViolin(out: Float32Array, note: InstrumentNote, context: InstrumentContext) {
  const { sampleRate } = context;
  const hertz = midiHz(note.pitch);
  const first = Math.max(0, Math.round(note.start * sampleRate));
  const body = Math.max(1, Math.round(note.duration * sampleRate));
  const attack = Math.max(1, Math.round(0.07 * sampleRate));
  const release = Math.max(1, Math.round(0.16 * sampleRate));
  const last = Math.min(out.length, first + body + release);
  const scratch = 1 / (0.045 * sampleRate);

  // A vibrato that comes in after the note starts. (The three notes of a chord are already a section.)
  const rate1 = hertz / sampleRate;
  const turn = (TWO_PI * 5.6) / sampleRate;
  const cosTurn = Math.cos(turn);
  const sinTurn = Math.sin(turn);
  const delay = Math.round(0.28 * sampleRate);
  const ramp = 1 / (0.35 * sampleRate);
  let sinV = 0;
  let cosV = 1;
  let phase1 = 0.13;

  const r1 = bandPass(BODY[0].f, BODY[0].bw, BODY[0].level, sampleRate);
  const r2 = bandPass(BODY[1].f, BODY[1].bw, BODY[1].level, sampleRate);
  const r3 = bandPass(BODY[2].f, BODY[2].bw, BODY[2].level, sampleRate);
  let x1 = 0;
  let x2 = 0;
  let a1 = 0;
  let a2 = 0;
  let b1 = 0;
  let b2 = 0;
  let c1 = 0;
  let c2 = 0;
  let seed = context.seed;

  for (let i = first, n = 0; i < last; i += 1, n += 1) {
    const nextSin = sinV * cosTurn + cosV * sinTurn;
    cosV = cosV * cosTurn - sinV * sinTurn;
    sinV = nextSin;
    const swing = n < delay ? 0 : Math.min(1, (n - delay) * ramp);
    const bend = 1 + 0.0062 * swing * sinV;

    phase1 += rate1 * bend;
    if (phase1 >= 1) phase1 -= 1;
    // A saw with the corner at each wrap rounded off, so its highs do not fold back into the lows.
    const step1 = rate1 * bend;
    let saw1 = 2 * phase1 - 1;
    if (phase1 < step1) {
      const t = phase1 / step1;
      saw1 -= t + t - t * t - 1;
    } else if (phase1 > 1 - step1) {
      const t = (phase1 - 1) / step1;
      saw1 -= t * t + t + t + 1;
    }

    // The scrape of the bow: strongest as it bites, then a faint hiss for as long as it draws.
    seed = noiseStep(seed);
    const hiss = (seed | 0) * 4.6566128730773926e-10;
    const bite = n < 2 / scratch ? 0.45 * (1 - n * scratch * 0.5) : 0;
    const x = saw1 + hiss * (0.035 + bite);

    const d = x - x2;
    x2 = x1;
    x1 = x;
    const y1 = r1.g * d + r1.b * a1 + r1.c * a2;
    a2 = a1;
    a1 = y1;
    const y2 = r2.g * d + r2.b * b1 + r2.c * b2;
    b2 = b1;
    b1 = y2;
    const y3 = r3.g * d + r3.b * c1 + r3.c * c2;
    c2 = c1;
    c1 = y3;
    const sample = 0.6 * x + 0.9 * (y1 + y2 + y3);

    const rise = n < attack ? (n + 1) / attack : 1;
    const fall = n < body ? 1 : Math.max(0, 1 - (n - body) / release);
    out[i] += sample * rise * rise * fall * note.velocity;
  }
  context.seed = seed;
}

/** Adds one note of the accompaniment into `out`. */
export function renderInstrumentNote(
  out: Float32Array,
  instrument: Instrument,
  note: InstrumentNote,
  context: InstrumentContext,
) {
  const scaled = { ...note, velocity: note.velocity * INSTRUMENT_GAIN[instrument] };
  // How hard a note is played, before the instrument's level is applied, decides if it is worth two strings.
  const heavy = 0.6 * INSTRUMENT_GAIN[instrument];
  if (instrument === 'guitar') renderStrings(out, scaled, context, GUITAR, heavy);
  else if (instrument === 'harp') renderStrings(out, scaled, context, HARP, heavy);
  else if (instrument === 'piano') renderStrings(out, scaled, context, PIANO, heavy);
  else renderViolin(out, scaled, context);
}
