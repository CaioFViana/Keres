import { describe, expect, it } from 'vitest';
import {
  buildBacking,
  defaultFeel,
  FEELS,
  INSTRUMENTS,
  voicing,
  type BackingNote,
} from '../../music/accompaniment';
import { renderInstrumentNote } from '../../music/instruments';
import { renderVoice, SAMPLE_RATE } from '../../music/voice';

const chord = (symbol: string, start = 0, end = 4) => ({ symbol, start, end, sectionIndex: 0 });
const backing = (
  chords: ReturnType<typeof chord>[],
  instrument: (typeof INSTRUMENTS)[number] = 'piano',
  feel: (typeof FEELS)[number] = 'ballad',
  meter = '4/4',
) => buildBacking(chords, { instrument, feel, meter });

describe('defaultFeel', () => {
  it('suggests a feel from the meter', () => {
    expect(defaultFeel('3/4')).toBe('waltz');
    expect(defaultFeel('6/8')).toBe('lullaby');
    expect(defaultFeel('12/8')).toBe('lullaby');
    expect(defaultFeel('2/4')).toBe('march');
    expect(defaultFeel('4/4')).toBe('ballad');
    expect(defaultFeel(null)).toBe('ballad');
  });
});

describe('voicing', () => {
  it('puts the chord around the middle of the keyboard and the bass below it', () => {
    expect(voicing('C')).toEqual({ bass: 36, fifth: 43, tones: [60, 64, 67] });
    expect(voicing('G')).toEqual({ bass: 43, fifth: 50, tones: [55, 59, 62] });
    expect(voicing('F#m')?.tones).toEqual([66, 69, 73]);
  });

  it('reads the extensions of a chord', () => {
    expect(voicing('Cmaj7')?.tones).toEqual([60, 64, 67, 71]);
    expect(voicing('Dm7')?.tones).toEqual([62, 65, 69, 72]);
    expect(voicing('G7')?.tones).toEqual([55, 59, 62, 65]);
  });

  it('plays the bass note a slash chord names', () => {
    expect(voicing('C/E')?.bass).toBe(40);
  });

  it('keeps every chord within an octave and a bit of the same hand', () => {
    for (const root of ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
      const tones = voicing(root)?.tones ?? [];
      expect(Math.min(...tones)).toBeGreaterThanOrEqual(55);
      expect(Math.max(...tones)).toBeLessThanOrEqual(73);
    }
  });

  it('is nothing for a mark that is no chord', () => {
    expect(voicing('N.C.')).toBeNull();
    expect(backing([chord('N.C.')])).toEqual([]);
  });
});

describe('buildBacking', () => {
  const at = (notes: BackingNote[], beat: number) => notes.filter((n) => n.start === beat);

  it('plays a waltz as a bass note and two stabs of the chord', () => {
    const notes = backing([chord('C', 0, 3)], 'piano', 'waltz', '3/4');

    expect(at(notes, 0).map((n) => n.pitch)).toEqual([36]);
    expect(at(notes, 1).map((n) => n.pitch)).toEqual([60, 64, 67]);
    expect(at(notes, 2).map((n) => n.pitch)).toEqual([60, 64, 67]);
  });

  it('plays a march as bass, chord, fifth, chord', () => {
    const notes = backing([chord('C', 0, 4)], 'piano', 'march');

    expect([0, 1, 2, 3].map((beat) => at(notes, beat).map((n) => n.pitch))).toEqual([
      [36],
      [60, 64, 67],
      [43],
      [60, 64, 67],
    ]);
  });

  it('plays a ballad as a bass and a running arpeggio', () => {
    const notes = backing([chord('C', 0, 4)], 'piano', 'ballad');

    expect(at(notes, 0).map((n) => n.pitch)).toEqual([36]);
    expect(at(notes, 2).map((n) => n.pitch)).toEqual([43]);
    expect(at(notes, 0.5).map((n) => n.pitch)).toEqual([60]);
    expect(at(notes, 1).map((n) => n.pitch)).toEqual([64]);
    expect(notes.every((n) => n.start >= 0 && n.start < 4)).toBe(true);
  });

  it('plays a lullaby as a bass and a rocking arpeggio of six eighths', () => {
    const notes = backing([chord('C', 0, 3)], 'piano', 'lullaby', '6/8');

    expect(notes.map((n) => [n.start, n.pitch])).toEqual([
      [0, 36],
      [0.5, 60],
      [1, 64],
      [1.5, 67],
      [2, 64],
      [2.5, 60],
    ]);
  });

  it('repeats the bar for as long as the chord lasts, and never past it', () => {
    const notes = backing([chord('C', 2, 8)], 'piano', 'waltz', '3/4');

    expect(notes.map((n) => n.start)).toEqual([2, 3, 3, 3, 4, 4, 4, 5, 6, 6, 6, 7, 7, 7]);
    for (const note of notes) expect(note.start + note.duration).toBeLessThanOrEqual(8 + 1e-9);
  });

  it('starts each chord where it is placed and follows one with the next', () => {
    const notes = backing([chord('C', 0, 4), chord('G', 4, 8)], 'piano', 'march');

    expect(at(notes, 0).map((n) => n.pitch)).toEqual([36]);
    expect(at(notes, 4).map((n) => n.pitch)).toEqual([43]);
  });

  it('rolls a chord for a guitar and more slowly for a harp, and not at all for a piano', () => {
    const stab = (instrument: (typeof INSTRUMENTS)[number]) =>
      backing([chord('C', 0, 3)], instrument, 'waltz', '3/4')
        .filter((n) => n.start >= 1 && n.start < 2)
        .map((n) => n.start - 1);

    expect(stab('piano')).toEqual([0, 0, 0]);
    expect(stab('guitar').map((n) => Number(n.toFixed(3)))).toEqual([0, 0.04, 0.08]);
    expect(stab('harp')[2]).toBeGreaterThan(stab('guitar')[2]);
  });

  it('holds the chord for a violin, three voices for the whole of it, whatever the feel', () => {
    for (const feel of FEELS) {
      const notes = backing([chord('Cmaj7', 4, 12)], 'violin', feel);

      expect(notes.map((n) => [n.pitch, n.start, n.duration])).toEqual([
        [60, 4, 8],
        [64, 4, 8],
        [67, 4, 8],
      ]);
    }
  });

  it('plays nothing without chords', () => {
    expect(backing([])).toEqual([]);
  });

  it('gives every note a velocity inside 0..1', () => {
    for (const instrument of INSTRUMENTS) {
      for (const feel of FEELS) {
        for (const note of backing([chord('Am', 0, 8)], instrument, feel)) {
          expect(note.velocity).toBeGreaterThan(0);
          expect(note.velocity).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

const peakOf = (samples: Float32Array, from = 0, to = samples.length) => {
  let top = 0;
  for (let i = from; i < to; i += 1) top = Math.max(top, Math.abs(samples[i]));
  return top;
};

/** The lag, in samples, at which a sound best repeats itself, found by autocorrelation. */
function periodOf(samples: Float32Array, from: number, length: number, around: number) {
  let best = -Infinity;
  let bestLag = 0;
  const scores = new Map<number, number>();
  for (let lag = Math.floor(around * 0.9); lag <= Math.ceil(around * 1.1); lag += 1) {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += samples[from + i] * samples[from + i + lag];
    scores.set(lag, sum);
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  const a = scores.get(bestLag - 1) ?? 0;
  const b = scores.get(bestLag) ?? 0;
  const c = scores.get(bestLag + 1) ?? 0;
  return bestLag + (0.5 * (a - c)) / (a - 2 * b + c);
}

describe('the instruments', () => {
  const single = (instrument: (typeof INSTRUMENTS)[number], pitch = 60, seconds = 2) =>
    renderVoice(
      {
        notes: [],
        beats: seconds,
        tempo: 60,
        backing: {
          instrument,
          notes: [{ pitch, start: 0, duration: seconds - 0.5, velocity: 0.8 }],
        },
      },
      { timbre: 'hum' },
    );

  it.each(INSTRUMENTS)('makes a sound for a %s that is finite and ends', (instrument) => {
    const out = single(instrument);

    expect(peakOf(out)).toBeGreaterThan(0.02);
    expect(peakOf(out)).toBeLessThanOrEqual(0.9);
    expect([...out].every(Number.isFinite)).toBe(true);
    expect(peakOf(out, out.length - 200)).toBeLessThan(0.01);
  });

  it.each(['guitar', 'harp'] as const)('keeps a plucked %s in tune at any pitch', (instrument) => {
    for (const pitch of [48, 55, 60, 67, 72, 79]) {
      const out = single(instrument, pitch);
      const expected = SAMPLE_RATE / (440 * 2 ** ((pitch - 69) / 12));
      const lag = periodOf(
        out,
        Math.round(0.05 * SAMPLE_RATE),
        Math.round(0.3 * SAMPLE_RATE),
        expected,
      );
      const cents = 1200 * Math.log2(expected / lag);

      expect(Math.abs(cents)).toBeLessThan(3);
    }
  });

  it.each(['piano', 'violin'] as const)('keeps a %s at the pitch asked', (instrument) => {
    const out = single(instrument, 64);
    const expected = SAMPLE_RATE / (440 * 2 ** ((64 - 69) / 12));
    const lag = periodOf(
      out,
      Math.round(0.5 * SAMPLE_RATE),
      Math.round(0.3 * SAMPLE_RATE),
      expected,
    );

    expect(Math.abs(1200 * Math.log2(expected / lag))).toBeLessThan(15);
  });

  it('lets a guitar string ring down, not stop short', () => {
    const out = single('guitar', 55, 3);
    const early = peakOf(out, Math.round(0.05 * SAMPLE_RATE), Math.round(0.3 * SAMPLE_RATE));
    const late = peakOf(out, Math.round(1.5 * SAMPLE_RATE), Math.round(1.8 * SAMPLE_RATE));

    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(early);
  });

  it('plays the same notes the same way twice', () => {
    expect([...single('harp', 62)]).toEqual([...single('harp', 62)]);
  });

  it('stays inside the buffer for a note that would run past it', () => {
    const out = new Float32Array(500);

    for (const instrument of INSTRUMENTS) {
      renderInstrumentNote(
        out,
        instrument,
        { pitch: 60, start: 0.01, duration: 5, velocity: 0.8 },
        { sampleRate: SAMPLE_RATE, seed: 1 },
      );
    }

    expect(out.length).toBe(500);
    expect([...out].every(Number.isFinite)).toBe(true);
  });
});
