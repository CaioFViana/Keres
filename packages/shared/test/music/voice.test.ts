import { describe, expect, it } from 'vitest';
import {
  encodeWav,
  renderLength,
  renderVoice,
  renderVoiceSliced,
  SAMPLE_RATE,
  VOICE_TIMBRES,
  type VoiceScore,
} from '../../music/voice';

const note = (pitch: number, start: number, duration = 1, sung = true) => ({
  pitch,
  start,
  duration,
  sung,
});
const score = (notes: ReturnType<typeof note>[], beats = 4, tempo = 120): VoiceScore => ({
  notes,
  beats,
  tempo,
});

const peak = (samples: Float32Array, from = 0, to = samples.length) => {
  let top = 0;
  for (let i = from; i < to; i += 1) top = Math.max(top, Math.abs(samples[i]));
  return top;
};

/** Energy of the samples at one frequency, Hann-windowed (a Goertzel the long way). */
function powerAt(samples: Float32Array, from: number, length: number, hertz: number) {
  let re = 0;
  let im = 0;
  for (let i = 0; i < length; i += 1) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / length);
    re += samples[from + i] * window * Math.cos((2 * Math.PI * hertz * i) / SAMPLE_RATE);
    im += samples[from + i] * window * Math.sin((2 * Math.PI * hertz * i) / SAMPLE_RATE);
  }
  return (re * re + im * im) / length;
}

describe('renderVoice', () => {
  it('makes a length that follows the tempo, with a tail for the release', () => {
    const out = renderVoice(score([note(60, 0)], 4, 120), { timbre: 'ah' });

    expect(out.length).toBe(renderLength(score([], 4, 120)));
    expect(out.length / SAMPLE_RATE).toBeCloseTo(2 + 0.09 + 0.05, 1);
  });

  it('is silent with no notes', () => {
    expect(peak(renderVoice(score([]), { timbre: 'hum' }))).toBe(0);
  });

  it.each(VOICE_TIMBRES)('renders %s the same way every time', (timbre) => {
    const notes = [note(60, 0), note(64, 1), note(67, 2, 2)];
    const a = renderVoice(score(notes), { timbre });
    const b = renderVoice(score(notes), { timbre });

    expect([...a]).toEqual([...b]);
  });

  it.each(VOICE_TIMBRES)('keeps %s audible and under full scale', (timbre) => {
    const out = renderVoice(score([note(48, 0, 2), note(72, 2, 2)], 8), { timbre });

    expect(peak(out)).toBeGreaterThan(0.1);
    expect(peak(out)).toBeLessThanOrEqual(0.9);
    expect([...out].every(Number.isFinite)).toBe(true);
  });

  it('sings at the pitch written, within the swing of the vibrato', () => {
    const out = renderVoice(score([note(69, 0, 2)], 4), { timbre: 'ah' });
    const from = Math.round(0.8 * SAMPLE_RATE);
    const length = Math.round(0.5 * SAMPLE_RATE);
    let best = 0;
    let bestHertz = 0;
    for (let hertz = 420; hertz <= 460; hertz += 1) {
      const power = powerAt(out, from, length, hertz);
      if (power > best) {
        best = power;
        bestHertz = hertz;
      }
    }

    expect(Math.abs(bestHertz - 440)).toBeLessThanOrEqual(4);
  });

  it('ends a note: after the release nothing is left', () => {
    const out = renderVoice(score([note(60, 0, 1)], 4), { timbre: 'ah' });
    const after = Math.round((0.5 + 0.09 + 0.05) * SAMPLE_RATE);

    expect(peak(out, after)).toBe(0);
    expect(peak(out, 0, Math.round(0.4 * SAMPLE_RATE))).toBeGreaterThan(0.05);
  });

  it('has a hum softer in its upper partials than the open vowel', () => {
    const notes = [note(60, 0, 2)];
    const from = Math.round(0.6 * SAMPLE_RATE);
    const length = Math.round(0.5 * SAMPLE_RATE);
    const ratio = (timbre: 'hum' | 'ah') => {
      const out = renderVoice(score(notes, 4), { timbre });
      return powerAt(out, from, length, 261.6 * 3) / powerAt(out, from, length, 261.6);
    };

    expect(ratio('hum')).toBeLessThan(ratio('ah'));
  });

  it('adds a click on each beat when asked, and none otherwise', () => {
    const quiet = renderVoice(score([], 4), { timbre: 'ah' });
    const clicking = renderVoice(score([], 4, 120), { timbre: 'ah', clickBeatsPerBar: 4 });
    const beat = Math.round(0.5 * SAMPLE_RATE);

    expect(peak(quiet)).toBe(0);
    expect(peak(clicking, beat, beat + 400)).toBeGreaterThan(0.05);
    expect(peak(clicking, beat + 2000, beat + 4000)).toBe(0);
  });

  it('starts a note that touches the one before it away from its own pitch, and one apart on it', () => {
    const touching = renderVoice(score([note(60, 0, 1), note(67, 1, 1)]), { timbre: 'ah' });
    const apart = renderVoice(score([note(60, 0, 1), note(67, 1.5, 1)]), { timbre: 'ah' });
    const target = 261.63 * 2 ** (7 / 12);
    const lower = 261.63;
    // The first 25 ms of the second note: a glide has not yet reached the target.
    const early = (out: Float32Array, startSeconds: number, hertz: number) =>
      powerAt(out, Math.round(startSeconds * SAMPLE_RATE), Math.round(0.025 * SAMPLE_RATE), hertz);

    const glided = early(touching, 0.5, target) / early(touching, 0.5, lower);
    const direct = early(apart, 0.75, target) / early(apart, 0.75, lower);

    expect(direct).toBeGreaterThan(glided);
  });
});

describe('renderVoiceSliced', () => {
  const notes = Array.from({ length: 24 }, (_, i) => note(60 + (i % 7), i * 0.5, 0.45));

  it('makes the same samples as the one-go render', async () => {
    const whole = renderVoice(score(notes, 12), { timbre: 'la' });
    const sliced = await renderVoiceSliced(
      score(notes, 12),
      { timbre: 'la' },
      { yieldToUi: async () => {} },
    );

    expect(sliced && [...sliced]).toEqual([...whole]);
  });

  it('gives the thread back between slices and reports its progress', async () => {
    let yields = 0;
    const progress: number[] = [];
    let clock = 0;
    await renderVoiceSliced(
      score(notes, 12),
      { timbre: 'ah' },
      {
        yieldToUi: async () => {
          yields += 1;
        },
        sliceMs: 5,
        // Each reading of the clock costs a millisecond, so a slice holds a few notes.
        now: () => (clock += 1),
        onProgress: (fraction) => progress.push(fraction),
      },
    );

    expect(yields).toBeGreaterThan(2);
    expect(progress[progress.length - 1]).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  it('stops when cancelled and returns nothing', async () => {
    let clock = 0;
    const result = await renderVoiceSliced(
      score(notes, 12),
      { timbre: 'ah' },
      {
        yieldToUi: async () => {},
        sliceMs: 1,
        now: () => (clock += 1),
        isCancelled: () => true,
      },
    );

    expect(result).toBeNull();
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM header for the samples', () => {
    const bytes = encodeWav(new Float32Array([0, 0.5, -0.5, 1.5, -1.5]), 22050);
    const view = new DataView(bytes.buffer);
    const text = (at: number, n: number) => String.fromCharCode(...bytes.slice(at, at + n));

    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(text(36, 4)).toBe('data');
    expect(view.getUint32(4, true)).toBe(36 + 10);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(10);
    expect(bytes.length).toBe(44 + 10);
  });

  it('scales the samples and clips what is beyond full scale', () => {
    const bytes = encodeWav(new Float32Array([0, 0.5, -0.5, 1.5, -1.5]));
    const view = new DataView(bytes.buffer);
    const at = (i: number) => view.getInt16(44 + i * 2, true);

    expect([0, 1, 2, 3, 4].map(at)).toEqual([0, 16384, -16383, 32767, -32767]);
  });
});
