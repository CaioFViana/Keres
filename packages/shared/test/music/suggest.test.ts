import { describe, expect, it } from 'vitest';
import { sectionWordsFor } from '../../music/chordpro';
import { parseMelody, replaceSection } from '../../music/melody';
import { suggestTune } from '../../music/suggest';

const MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);
const MINOR = new Set([0, 2, 3, 5, 7, 8, 10]);

const tune = (
  syllablesPerLine: number[],
  key: string | null = 'C',
  attempt = 0,
  meter: string | null = '4/4',
) => suggestTune({ syllablesPerLine, key, meter, attempt });

describe('suggestTune', () => {
  it('writes a note for each syllable of each line, and no more', () => {
    const result = parseMelody(tune([6, 8, 7, 5]));

    expect(result.errors).toEqual([]);
    expect(result.sections[0].syllables).toBe(26);
    expect(tune([6, 8, 7, 5]).split('\n')).toHaveLength(4);
  });

  it('gives the same tune to the same words and the same try, and another to the next', () => {
    expect(tune([6, 8], 'G', 3)).toBe(tune([6, 8], 'G', 3));
    expect(tune([6, 8], 'G', 3)).not.toBe(tune([6, 8], 'G', 4));
  });

  it('stays in the key of the song', () => {
    for (const [key, scale, tonic] of [
      ['C', MAJOR, 0],
      ['G', MAJOR, 7],
      ['Bb', MAJOR, 10],
      ['Em', MINOR, 4],
      [null, MAJOR, 0],
    ] as const) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const pitches = parseMelody(tune([7, 7, 7, 7], key, attempt)).sections[0].notes.map(
          (n) => n.pitch as number,
        );
        for (const pitch of pitches) expect(scale.has((((pitch - tonic) % 12) + 12) % 12)).toBe(true);
      }
    }
  });

  it('keeps to a singable range around middle C', () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const pitches = parseMelody(tune([9, 9, 9, 9], 'D', attempt)).sections[0].notes.map(
        (n) => n.pitch as number,
      );
      expect(Math.min(...pitches)).toBeGreaterThanOrEqual(52);
      expect(Math.max(...pitches)).toBeLessThanOrEqual(84);
    }
  });

  it('comes home on the last note of the last line', () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const notes = parseMelody(tune([6, 6, 6, 6], 'G', attempt)).sections[0].notes;
      expect(((notes[notes.length - 1].pitch as number) - 7 + 120) % 12).toBe(0);
    }
  });

  it('rests the end of an early line on the fifth or the third, not on home', () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const lines = tune([6, 6, 6], 'C', attempt).split('\n');
      const endOf = (line: string) => parseMelody(line).sections[0].notes.slice(-1)[0].pitch as number;
      expect(endOf(lines[0]) % 12).toBe(7);
      expect(endOf(lines[1]) % 12).toBe(4);
    }
  });

  it('fills the bars of each line, whatever the meter', () => {
    for (const [meter, bar] of [
      ['4/4', 4],
      ['3/4', 3],
      ['2/4', 2],
      ['6/8', 3],
    ] as const) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        for (const line of tune([5, 7, 6], 'C', attempt, meter).split('\n')) {
          const length = parseMelody(line).sections[0].length;
          expect(length % bar).toBe(0);
        }
      }
    }
  });

  it('never ends a line on a half beat', () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      for (const line of tune([5, 6, 7], 'C', attempt).split('\n')) {
        const last = parseMelody(line).sections[0].notes.slice(-1)[0];
        expect(last.duration).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('moves mostly by step', () => {
    const pitches = parseMelody(tune([9, 9, 9, 9], 'C', 2)).sections[0].notes.map(
      (n) => n.pitch as number,
    );
    const jumps = pitches.slice(1).map((pitch, i) => Math.abs(pitch - pitches[i]));
    const stepwise = jumps.filter((jump) => jump <= 2).length;

    expect(stepwise / jumps.length).toBeGreaterThan(0.6);
  });

  it('spells the notes in the flats of a flat key', () => {
    const text = tune([8, 8, 8, 8], 'Bb', 1);

    expect(text).toMatch(/_[BE]/);
    expect(text).not.toMatch(/\^/);
  });

  it('writes a single syllable, and nothing for no lines', () => {
    expect(parseMelody(tune([1])).sections[0].syllables).toBe(1);
    expect(tune([])).toBe('');
    expect(tune([0, 0])).toBe('');
  });

  it('leaves out the lines that have no syllables', () => {
    expect(tune([4, 0, 4]).split('\n')).toHaveLength(2);
  });
});

describe('replaceSection', () => {
  it('puts a tune in a section that is not there yet', () => {
    expect(replaceSection('', 'Verse 1', 'C D')).toBe('P:Verse 1\nC D');
    expect(replaceSection('P:A\nC', 'B', 'D E')).toBe('P:A\nC\nP:B\nD E');
  });

  it('replaces the notes of a section and leaves the others alone', () => {
    expect(replaceSection('P:A\nC D\nE F\nP:B\nG A', 'A', 'c d')).toBe('P:A\nc d\nP:B\nG A');
    expect(replaceSection('P:A\nC D\nP:B\nG A', 'B', 'c d')).toBe('P:A\nC D\nP:B\nc d');
  });

  it('keeps the fields under a heading', () => {
    expect(replaceSection('P:A\nM:3/4\nC D', 'A', 'e f')).toBe('P:A\nM:3/4\ne f');
  });

  it('writes the tune of no label before the first labelled one', () => {
    expect(replaceSection('P:A\nC', null, 'g a')).toBe('g a\nP:A\nC');
    expect(replaceSection('g a\nP:A\nC', null, 'c d')).toBe('c d\nP:A\nC');
  });

  it('reads back as the tune that was written', () => {
    const written = replaceSection('', 'Verse 1', tune([5, 5]));

    expect(parseMelody(written).sections[0].label).toBe('Verse 1');
    expect(parseMelody(written).sections[0].syllables).toBe(10);
  });
});

describe('sectionWordsFor', () => {
  it('names a new section in the language of the work', () => {
    expect(sectionWordsFor('pt')).toEqual({ verse: 'Verso', chorus: 'Refrão', bridge: 'Ponte' });
    expect(sectionWordsFor('pt-BR').verse).toBe('Verso');
    expect(sectionWordsFor('en')).toEqual({ verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge' });
  });

  it('falls back to English for a language it has no words for, or for none', () => {
    expect(sectionWordsFor('ja').verse).toBe('Verse');
    expect(sectionWordsFor(undefined).chorus).toBe('Chorus');
    expect(sectionWordsFor(null).bridge).toBe('Bridge');
  });
});
