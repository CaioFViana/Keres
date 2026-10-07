import type { Instrument } from './accompaniment';

/**
 * The four instruments of the accompaniment, made of arithmetic like the voice: a plucked string by
 * Karplus-Strong (a burst of noise circulating in a short delay with a little loss), a piano by a
 * few decaying partials, a violin by a filtered saw with a slow bow. None is a recording and none
 * pretends to be - they are there to give a tune something to stand on. As in the voice, the loops
 * here call nothing and allocate nothing per sample.
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
  guitar: 0.2,
  harp: 0.2,
  piano: 0.14,
  violin: 0.105,
};

function noiseStep(seed: number): number {
  let state = seed;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state;
}

interface Pluck {
  /** The share of the loop kept on each pass: how long the string rings. */
  decay: number;
  /** How much of the first burst's brightness stays, 0 (dull) to 1 (bright). */
  brightness: number;
  /** Seconds the string takes to be damped once the player lets go. */
  release: number;
}

const PLUCKS: Record<'guitar' | 'harp', Pluck> = {
  guitar: { decay: 0.9972, brightness: 0.55, release: 0.12 },
  harp: { decay: 0.9986, brightness: 0.8, release: 0.35 },
};

function renderPluck(
  out: Float32Array,
  note: InstrumentNote,
  context: InstrumentContext,
  string: Pluck,
) {
  const { sampleRate } = context;
  // The loop must delay by one period. Averaging a sample with its newer neighbour takes half a sample
  // off the length of the buffer; what is missing, up to a sample, is made up by an all-pass, so a string is in tune and not merely on a whole number of samples.
  const period = sampleRate / midiHz(note.pitch);
  const size = Math.max(2, Math.floor(period + 0.4));
  const extra = Math.max(0.1, period - size + 0.5);
  const tune = (1 - extra) / (1 + extra);
  const buffer = new Float32Array(size);
  let seed = context.seed;
  let soft = 0;
  for (let i = 0; i < size; i += 1) {
    seed = noiseStep(seed);
    const noise = (seed | 0) * 4.6566128730773926e-10;
    // The burst is softened to the brightness asked for: a dull string starts without upper partials.
    soft += string.brightness * (noise - soft);
    buffer[i] = soft * 1.8 * note.velocity;
  }
  context.seed = seed;

  const first = Math.max(0, Math.round(note.start * sampleRate));
  const body = Math.max(1, Math.round(note.duration * sampleRate));
  const tail = Math.round(string.release * sampleRate);
  const last = Math.min(out.length, first + body + tail);
  const fadeStart = first + body;
  const fadeStep = 1 / Math.max(1, Math.round(string.release * sampleRate));
  const decay = string.decay;
  let at = 0;
  let level = 1;
  let allpassIn = 0;
  let allpassOut = 0;
  for (let i = first; i < last; i += 1) {
    const next = at + 1 === size ? 0 : at + 1;
    const value = buffer[at];
    const averaged = decay * 0.5 * (value + buffer[next]);
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

/** The partials a piano note is made of: how loud each is, and how much faster it dies than the one below. */
const PARTIAL_AMPLITUDE = [1, 0.5, 0.26] as const;
const PARTIAL_SPEED = [1, 1.7, 2.6] as const;

function renderPiano(out: Float32Array, note: InstrumentNote, context: InstrumentContext) {
  const { sampleRate } = context;
  const hertz = midiHz(note.pitch);
  // Low strings ring longer than high ones.
  const rate = Math.min(4, Math.max(0.9, 3 - (note.pitch - 48) / 24));
  const first = Math.max(0, Math.round(note.start * sampleRate));
  const body = Math.max(1, Math.round(note.duration * sampleRate));
  const release = Math.round(0.2 * sampleRate);
  const last = Math.min(out.length, first + body + release);
  const attack = Math.max(1, Math.round(0.004 * sampleRate));
  const fadeStart = first + body;
  const fadeStep = 1 / Math.max(1, release);

  // Three partials, each a phasor turned a fixed angle per sample and an amplitude that shrinks.
  // Written out one by one and not in a loop: the phone's engine pays for every index it takes.
  const turn1 = (TWO_PI * hertz) / sampleRate;
  const c1 = Math.cos(turn1);
  const s1 = Math.sin(turn1);
  const c2 = Math.cos(2 * turn1);
  const s2 = Math.sin(2 * turn1);
  const c3 = Math.cos(3 * turn1);
  const s3 = Math.sin(3 * turn1);
  // A partial past the top of the range would only fold back into the others.
  const upper = hertz * 3 < sampleRate * 0.45;
  let a1 = note.velocity * PARTIAL_AMPLITUDE[0];
  let a2 = note.velocity * PARTIAL_AMPLITUDE[1];
  let a3 = upper ? note.velocity * PARTIAL_AMPLITUDE[2] : 0;
  const d1 = Math.exp((-rate * PARTIAL_SPEED[0]) / sampleRate);
  const d2 = Math.exp((-rate * PARTIAL_SPEED[1]) / sampleRate);
  const d3 = Math.exp((-rate * PARTIAL_SPEED[2]) / sampleRate);
  let x1 = 0;
  let y1 = 1;
  let x2 = 0;
  let y2 = 1;
  let x3 = 0;
  let y3 = 1;
  let level = 1;
  for (let i = first, n = 0; i < last; i += 1, n += 1) {
    const nx1 = x1 * c1 + y1 * s1;
    y1 = y1 * c1 - x1 * s1;
    x1 = nx1;
    const nx2 = x2 * c2 + y2 * s2;
    y2 = y2 * c2 - x2 * s2;
    x2 = nx2;
    const nx3 = x3 * c3 + y3 * s3;
    y3 = y3 * c3 - x3 * s3;
    x3 = nx3;
    const sample = a1 * x1 + a2 * x2 + a3 * x3;
    a1 *= d1;
    a2 *= d2;
    a3 *= d3;
    if (i >= fadeStart) {
      level -= fadeStep;
      if (level <= 0) break;
    }
    out[i] += sample * level * (n < attack ? (n + 1) / attack : 1);
  }
}

function renderViolin(out: Float32Array, note: InstrumentNote, context: InstrumentContext) {
  const { sampleRate } = context;
  const hertz = midiHz(note.pitch);
  const first = Math.max(0, Math.round(note.start * sampleRate));
  const body = Math.max(1, Math.round(note.duration * sampleRate));
  const attack = Math.max(1, Math.round(0.09 * sampleRate));
  const release = Math.max(1, Math.round(0.18 * sampleRate));
  const last = Math.min(out.length, first + body + release);
  // A bright bow on a high note, a darker one on a low: the cutoff follows the pitch.
  const cutoff = Math.min(0.5, (hertz * 5) / sampleRate);
  const coefficient = 1 - Math.exp(-TWO_PI * cutoff);
  const turn = (TWO_PI * 5.2) / sampleRate;
  const cosTurn = Math.cos(turn);
  const sinTurn = Math.sin(turn);
  const delay = Math.round(0.3 * sampleRate);
  let sinV = 0;
  let cosV = 1;
  let phase = 0;
  let low1 = 0;
  let low2 = 0;
  let seed = context.seed;
  for (let i = first, n = 0; i < last; i += 1, n += 1) {
    const nextSin = sinV * cosTurn + cosV * sinTurn;
    cosV = cosV * cosTurn - sinV * sinTurn;
    sinV = nextSin;
    const swing = n < delay ? 0 : 0.0045;
    phase += (hertz / sampleRate) * (1 + swing * sinV);
    if (phase >= 1) phase -= 1;
    seed = noiseStep(seed);
    const bow = (seed | 0) * 4.6566128730773926e-10 * 0.04;
    const saw = 2 * phase - 1 + bow;
    low1 += coefficient * (saw - low1);
    low2 += coefficient * (low1 - low2);
    const rise = n < attack ? (n + 1) / attack : 1;
    const fall = n < body ? 1 : Math.max(0, 1 - (n - body) / release);
    out[i] += low2 * rise * fall * note.velocity;
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
  if (instrument === 'guitar' || instrument === 'harp') {
    renderPluck(out, scaled, context, PLUCKS[instrument]);
  } else if (instrument === 'piano') {
    renderPiano(out, scaled, context);
  } else {
    renderViolin(out, scaled, context);
  }
}
