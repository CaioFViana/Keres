import { keyPrefersFlats, pitchOfName } from './chords';
import { noteToken } from './melody';
import { quarterBeatsPerBar } from './songStats';

/**
 * A tune to start from, for someone who writes songs and not music: a note for every syllable, moving
 * by step in the key of the song and coming to rest where a tune rests - on the fifth at the end of
 * the first line, the third at the end of the second, home at the end of the last - with each line
 * filling its bars. It is a sketch to sing over and change, never a composition; the same words and
 * the same try always give the same tune, and the next try gives another.
 */
export interface SuggestInput {
  /** The syllables of each line of the part, in order (lines with none are left out by the caller). */
  syllablesPerLine: readonly number[];
  /** `G`, `Em`, `Bb`: the key of the song; a song with none is taken in C major. */
  key: string | null;
  meter: string | null;
  /** Which try this is: the same number gives the same tune. */
  attempt: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR = [0, 2, 3, 5, 7, 8, 10] as const;
/** The lowest and highest steps of the scale a tune wanders over, counted from the tonic near middle C. */
const LOW = -2;
const HIGH = 9;

/** A small deterministic generator, so a try is repeatable. */
function generator(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scaleOf(key: string | null) {
  const match = key ? /^([A-G][#b]?)(m|min|minor)?/.exec(key.trim()) : null;
  const tonic = match ? (pitchOfName(match[1]) ?? 0) : 0;
  return { tonic, steps: match?.[2] ? MINOR : MAJOR };
}

/** The pitch of a step of the scale: 0 is the tonic at or just above middle C, 7 an octave up. */
function pitchOfStep(step: number, tonic: number, steps: readonly number[]): number {
  const octave = Math.floor(step / 7);
  const degree = ((step % 7) + 7) % 7;
  return 60 + tonic + steps[degree] + 12 * octave;
}

/** How long each syllable lasts: whole beats, with the odd pair of halves so that it does not march. */
function rhythmOf(count: number, bar: number, random: () => number): number[] {
  const lengths: number[] = [];
  for (let i = 0; i < count; ) {
    // A pair of halves never takes the last syllable: the line ends on a whole beat or longer.
    if (i + 1 < count - 1 && random() < 0.28) {
      lengths.push(0.5, 0.5);
      i += 2;
    } else {
      lengths.push(1);
      i += 1;
    }
  }
  // The line fills its bars: the last note holds to the next bar line.
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const fill = (bar - (total % bar)) % bar;
  lengths[count - 1] += fill;
  return lengths;
}

/** Notes for the lines of a part, as the text of a tune: one text line for each line of the words. */
export function suggestTune(input: SuggestInput): string {
  const { tonic, steps } = scaleOf(input.key);
  const flats = input.key ? keyPrefersFlats(input.key) : false;
  const bar = quarterBeatsPerBar(input.meter);
  const lines = input.syllablesPerLine.filter((count) => count > 0);
  const random = generator(input.attempt * 7919 + lines.reduce((sum, count) => sum * 31 + count, 17));
  const out: string[] = [];
  let step = [0, 2, 4][Math.floor(random() * 3)];

  lines.forEach((count, index) => {
    // Where the line comes to rest: the fifth, then the third, and the last line home.
    const rest = index === lines.length - 1 ? 0 : index % 2 === 0 ? 4 : 2;
    const lengths = rhythmOf(count, bar, random);
    const tokens: string[] = [];
    for (let n = 0; n < count; n += 1) {
      if (n > 0) {
        // The pull toward where the line must end grows as the syllables run out.
        const distance = rest - step;
        const pull = Math.sign(distance) * Math.min(1, Math.abs(distance) / (count - n + 1));
        const roll = random();
        const move =
          pull !== 0 && roll < 0.2 + 0.5 * Math.abs(pull)
            ? Math.sign(pull)
            : roll < 0.78
              ? random() < 0.5
                ? 1
                : -1
              : roll < 0.88
                ? 0
                : random() < 0.5
                  ? 2
                  : -2;
        step = Math.min(HIGH, Math.max(LOW, step + move));
      }
      if (n === count - 1) step = rest;
      tokens.push(noteToken(pitchOfStep(step, tonic, steps), lengths[n], flats));
    }
    out.push(tokens.join(' '));
  });
  return out.join('\n');
}
