import type { BackingNote, Instrument } from './accompaniment';
import { renderInstrumentNote } from './instruments';
import type { PlayNote } from './timeline';

/**
 * A singing voice made of arithmetic: a glottal pulse train pushed through three resonators, the
 * formants of a vowel, one voice at a time. It does not say words - a tune hummed ("mm"), sung on a
 * vowel ("ah") or on a syllable ("la") is the whole repertoire - which is why it needs no recordings,
 * no native module and almost no time.
 *
 * It runs in plain JavaScript on purpose, in the same code on a phone, in a browser and under test.
 * The inner loop is kept free of calls (no `sin`, no `pow`, no allocation per sample), because the
 * phone's engine does not compile it: every operation in it is paid for at its face value. Its output
 * is a pure function of the notes and the options (the noise is a seeded generator), so a rendering
 * can be cached by a hash of what produced it.
 */
export type VoiceTimbre = 'hum' | 'ah' | 'la';
export const VOICE_TIMBRES: readonly VoiceTimbre[] = ['hum', 'ah', 'la'];

export const SAMPLE_RATE = 22050;

interface Formants {
  f: [number, number, number];
  bw: [number, number, number];
  /**
   * How loud each formant is against the first. They are set by hand, not left to the filters: a
   * sung vowel keeps a good deal of energy in the second and third, which a cascade would take away.
   */
  level: [number, number, number];
  /** Level of the voice: a hum is quieter than an open vowel, so it is lifted to match. */
  gain: number;
}

const AH: Formants = { f: [730, 1090, 2440], bw: [90, 110, 170], level: [1, 0.5, 0.25], gain: 1 };
const HUM: Formants = {
  f: [270, 1200, 2400],
  bw: [70, 120, 160],
  level: [1, 0.15, 0.05],
  gain: 0.68,
};
/** The tongue on the ridge before the vowel opens: `la` begins here and glides to `ah`. */
const LA_START: Formants = {
  f: [360, 1100, 2700],
  bw: [80, 120, 180],
  level: [1, 0.4, 0.2],
  gain: 1,
};

export interface VoiceOptions {
  timbre: VoiceTimbre;
  sampleRate?: number;
  /** Mix a click on each beat; the number is the beats in a bar (the first is accented). */
  clickBeatsPerBar?: number;
}

/** What an instrument plays under the voice. */
export interface Backing {
  instrument: Instrument;
  notes: readonly BackingNote[];
}

export interface VoiceScore {
  notes: readonly PlayNote[];
  /** The accompaniment, rendered with the voice into the same samples. */
  backing?: Backing;
  /** Quarter notes in all. */
  beats: number;
  tempo: number;
}

const TWO_PI = Math.PI * 2;
const VIBRATO_HZ = 5.4;
/** Half the swing of the vibrato, as a fraction of the pitch (about 28 cents). */
const VIBRATO_DEPTH = 0.0162;
const VIBRATO_DELAY = 0.22;
const VIBRATO_RAMP = 0.25;
const ATTACK = 0.03;
const RELEASE = 0.09;
const GLIDE = 0.06;
/** A note that begins within this many seconds of the end of the one before glides from it. */
const LEGATO_GAP = 0.05;
/** Samples between recomputing the resonator coefficients (they only move while `la` opens). */
const COEFFICIENT_STEP = 32;
const SOURCE_GAIN = 1.3;

const midiHz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

/**
 * The slope of the glottal flow over one period, tabulated: a smooth open phase and a quick close.
 * The lips radiate the slope, not the flow, which is what makes the voice bright.
 */
const TABLE_SIZE = 512;
const GLOTTAL_SLOPE = (() => {
  const open = 0.6;
  const close = 0.12;
  const flow = (phase: number) => {
    if (phase < open) return 0.5 * (1 - Math.cos((Math.PI * phase) / open));
    if (phase < open + close) return Math.cos((Math.PI * (phase - open)) / (2 * close));
    return 0;
  };
  const table = new Float64Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i += 1) {
    table[i] = (flow((i + 1) / TABLE_SIZE) - flow(i / TABLE_SIZE)) * (TABLE_SIZE / 8);
  }
  return table;
})();

interface RenderContext {
  sampleRate: number;
  timbre: VoiceTimbre;
  /** The state of the noise generator, which carries from note to note. */
  seed: number;
  /** Resonator coefficients: `g, b, c` for each of the three formants. */
  coefficients: Float64Array;
}

const newContext = (options: VoiceOptions): RenderContext => ({
  sampleRate: options.sampleRate ?? SAMPLE_RATE,
  timbre: options.timbre,
  seed: 0x9e3779b9,
  coefficients: new Float64Array(9),
});

function setResonators(
  target: Float64Array,
  from: Formants,
  to: Formants,
  t: number,
  sampleRate: number,
) {
  for (let k = 0; k < 3; k += 1) {
    const frequency = from.f[k] + (to.f[k] - from.f[k]) * t;
    const bandwidth = from.bw[k] + (to.bw[k] - from.bw[k]) * t;
    const level = from.level[k] + (to.level[k] - from.level[k]) * t;
    const theta = (TWO_PI * frequency) / sampleRate;
    const radius = Math.exp((-Math.PI * bandwidth) / sampleRate);
    const b = 2 * radius * Math.cos(theta);
    const c = -radius * radius;
    // A band-pass: the zero at DC keeps the low rumble out; the gain puts its peak at `level`.
    const real = 1 - b * Math.cos(theta) - c * Math.cos(2 * theta);
    const imaginary = b * Math.sin(theta) + c * Math.sin(2 * theta);
    target[k * 3] = (level * Math.hypot(real, imaginary)) / (2 * Math.abs(Math.sin(theta)));
    target[k * 3 + 1] = b;
    target[k * 3 + 2] = c;
  }
}

/** Adds one note into `out`; `previous` is the note it may glide from. */
function renderNote(
  out: Float32Array,
  note: { pitch: number; start: number; duration: number },
  previous: { pitch: number; end: number } | null,
  context: RenderContext,
) {
  const { sampleRate, timbre, coefficients } = context;
  const first = Math.max(0, Math.round(note.start * sampleRate));
  const body = Math.max(1, Math.round(note.duration * sampleRate));
  const tail = Math.round(RELEASE * sampleRate);
  const length = Math.min(out.length - first, body + tail);
  if (length <= 0) return;

  const target = midiHz(note.pitch);
  const from =
    previous && note.start - previous.end <= LEGATO_GAP && previous.pitch !== note.pitch
      ? midiHz(previous.pitch)
      : target;
  const glide = Math.max(1, Math.round(GLIDE * sampleRate));
  const slideStep = (target - from) / glide;
  const attack = Math.max(1, Math.round(ATTACK * sampleRate));
  const delay = Math.round(VIBRATO_DELAY * sampleRate);
  const rampInverse = 1 / (VIBRATO_RAMP * sampleRate);
  const releaseStep = 1 / Math.max(1, tail);
  const attackStep = 1 / attack;

  // The vibrato is a phasor turned a fixed angle per sample, which costs a few multiplications.
  const turn = (TWO_PI * VIBRATO_HZ) / sampleRate;
  const cosTurn = Math.cos(turn);
  const sinTurn = Math.sin(turn);
  let sinV = 0;
  let cosV = 1;

  const base = timbre === 'hum' ? HUM : AH;
  const start = timbre === 'la' ? LA_START : base;
  const opening = Math.round(0.07 * sampleRate);
  const gain = base.gain * SOURCE_GAIN;
  const hum = timbre === 'hum';
  const opens = timbre === 'la';
  setResonators(coefficients, start, base, opens ? 0 : 1, sampleRate);
  let g1 = coefficients[0];
  let b1 = coefficients[1];
  let c1 = coefficients[2];
  let g2 = coefficients[3];
  let b2 = coefficients[4];
  let c2 = coefficients[5];
  let g3 = coefficients[6];
  let b3 = coefficients[7];
  let c3 = coefficients[8];

  let phase = 0;
  let x1 = 0;
  let x2 = 0;
  let u1 = 0;
  let u2 = 0;
  let v1 = 0;
  let v2 = 0;
  let w1 = 0;
  let w2 = 0;
  let low = 0;
  let seed = context.seed;
  const lastIndex = first + length;

  for (let i = 0, at = first; at < lastIndex; i += 1, at += 1) {
    if (opens && i <= opening && i % COEFFICIENT_STEP === 0) {
      setResonators(coefficients, start, base, i / opening, sampleRate);
      g1 = coefficients[0];
      b1 = coefficients[1];
      c1 = coefficients[2];
      g2 = coefficients[3];
      b2 = coefficients[4];
      c2 = coefficients[5];
      g3 = coefficients[6];
      b3 = coefficients[7];
      c3 = coefficients[8];
    }

    const swing = i <= delay ? 0 : Math.min(1, (i - delay) * rampInverse);
    const nextSin = sinV * cosTurn + cosV * sinTurn;
    cosV = cosV * cosTurn - sinV * sinTurn;
    sinV = nextSin;
    const centre = i < glide ? from + slideStep * i : target;
    const hertz = centre * (1 + VIBRATO_DEPTH * swing * sinV);

    phase += hertz / sampleRate;
    if (phase >= 1) phase -= 1;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const breath = (seed | 0) * 4.6566128730773926e-10;

    const x = GLOTTAL_SLOPE[(phase * TABLE_SIZE) | 0] + breath * 0.02;
    const d = x - x2;
    x2 = x1;
    x1 = x;
    const y = g1 * d + b1 * u1 + c1 * u2;
    u2 = u1;
    u1 = y;
    const z = g2 * d + b2 * v1 + c2 * v2;
    v2 = v1;
    v1 = z;
    const q = g3 * d + b3 * w1 + c3 * w2;
    w2 = w1;
    w1 = q;
    let sample = y + z + q;
    if (hum) {
      // A closed mouth: what is left after the nose is low and round.
      low += 0.28 * (sample - low);
      sample = low;
    }

    const rise = i < attack ? (i + 1) * attackStep : 1;
    const fall = i < body ? 1 : Math.max(0, 1 - (i - body) * releaseStep);
    out[at] += sample * rise * fall * gain;
  }
  context.seed = seed;
}

function addClicks(out: Float32Array, score: VoiceScore, beatsPerBar: number, sampleRate: number) {
  const secondsPerBeat = 60 / score.tempo;
  const length = Math.round(0.018 * sampleRate);
  for (let beat = 0; beat < score.beats; beat += 1) {
    const at = Math.round(beat * secondsPerBeat * sampleRate);
    const accented = beat % beatsPerBar === 0;
    const hertz = accented ? 1500 : 1000;
    for (let i = 0; i < length && at + i < out.length; i += 1) {
      out[at + i] += Math.sin((TWO_PI * hertz * i) / sampleRate) * (1 - i / length) * 0.18;
    }
  }
}

/** The samples the score would take (and a short tail), to allocate before rendering. */
export function renderLength(score: VoiceScore, sampleRate = SAMPLE_RATE): number {
  const seconds = (score.beats * 60) / score.tempo;
  return Math.ceil((seconds + RELEASE + 0.05) * sampleRate);
}

/** Never louder than full scale, and never boosted: a quiet passage stays quiet. */
function finish(out: Float32Array) {
  let peak = 0;
  for (let i = 0; i < out.length; i += 1) {
    const level = Math.abs(out[i]);
    if (level > peak) peak = level;
  }
  const scale = peak > 0.9 ? 0.9 / peak : 1;
  if (scale !== 1) for (let i = 0; i < out.length; i += 1) out[i] *= scale;
  return out;
}

const secondsOf = (note: PlayNote, tempo: number) => ({
  pitch: note.pitch,
  start: (note.start * 60) / tempo,
  duration: (note.duration * 60) / tempo,
});

/**
 * The work of a render, one note at a time: the voice first, then the accompaniment, then the click.
 * Each step yields the fraction done, so a caller can run it to the end or stop between notes.
 */
function* steps(
  score: VoiceScore,
  options: VoiceOptions,
  out: Float32Array,
  context: RenderContext,
): Generator<number> {
  const backing = score.backing;
  const total = Math.max(1, score.notes.length + (backing?.notes.length ?? 0));
  let done = 0;
  let previous: { pitch: number; end: number } | null = null;
  for (const note of score.notes) {
    const timed = secondsOf(note, score.tempo);
    renderNote(out, timed, previous, context);
    previous = { pitch: timed.pitch, end: timed.start + timed.duration };
    done += 1;
    yield done / total;
  }
  if (backing) {
    const instrumentContext = { sampleRate: context.sampleRate, seed: 0x2545f491 };
    for (const note of backing.notes) {
      renderInstrumentNote(
        out,
        backing.instrument,
        {
          pitch: note.pitch,
          start: (note.start * 60) / score.tempo,
          duration: (note.duration * 60) / score.tempo,
          velocity: note.velocity,
        },
        instrumentContext,
      );
      done += 1;
      yield done / total;
    }
  }
  if (options.clickBeatsPerBar) {
    addClicks(out, score, options.clickBeatsPerBar, context.sampleRate);
  }
}

/** Renders the score in one go. For a long one prefer `renderVoiceSliced`, which lets the screen breathe. */
export function renderVoice(score: VoiceScore, options: VoiceOptions): Float32Array {
  const context = newContext(options);
  const out = new Float32Array(renderLength(score, context.sampleRate));
  for (const _ of steps(score, options, out, context)) {
    // Nothing to do between notes.
  }
  return finish(out);
}

export interface SliceHooks {
  /** Gives the thread back (a `setTimeout`, a frame); awaited between slices. */
  yieldToUi: () => Promise<void>;
  /** Milliseconds of work between yields; the default is most of a frame. */
  sliceMs?: number;
  now?: () => number;
  /** Fraction done, 0..1. */
  onProgress?: (fraction: number) => void;
  /** Checked between slices; `true` stops the render and returns `null`. */
  isCancelled?: () => boolean;
}

/**
 * The same samples as `renderVoice`, made in slices of a few milliseconds with the thread given back
 * between them, so a phone keeps drawing while a song is prepared. Returns `null` if cancelled.
 */
export async function renderVoiceSliced(
  score: VoiceScore,
  options: VoiceOptions,
  hooks: SliceHooks,
): Promise<Float32Array | null> {
  const context = newContext(options);
  const now = hooks.now ?? (() => Date.now());
  const budget = hooks.sliceMs ?? 12;
  const out = new Float32Array(renderLength(score, context.sampleRate));
  let sliceStart = now();

  for (const fraction of steps(score, options, out, context)) {
    if (now() - sliceStart >= budget) {
      hooks.onProgress?.(fraction);
      await hooks.yieldToUi();
      if (hooks.isCancelled?.()) return null;
      sliceStart = now();
    }
  }
  hooks.onProgress?.(1);
  return finish(out);
}

/** 16-bit mono PCM in a WAV container. */
export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(at + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clipped * 32767), true);
  }
  return bytes;
}
