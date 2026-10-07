import { describe, expect, it } from 'vitest';
import {
  chordIntervals,
  keyPrefersFlats,
  parseChord,
  pitchOfName,
  transposeChord,
  transposeKey,
  transposeLyrics,
} from '../../music/chords';

describe('pitchOfName', () => {
  it('gives the pitch class, with sharps and flats and their odd spellings', () => {
    expect(pitchOfName('C')).toBe(0);
    expect(pitchOfName('F#')).toBe(6);
    expect(pitchOfName('Bb')).toBe(10);
    expect(pitchOfName('E#')).toBe(5);
    expect(pitchOfName('Cb')).toBe(11);
    expect(pitchOfName('h')).toBeNull();
    expect(pitchOfName('')).toBeNull();
  });
});

describe('parseChord', () => {
  it('reads the root, the suffix and the bass note', () => {
    expect(parseChord('Am7')).toEqual({
      root: 'A',
      rootPitch: 9,
      suffix: 'm7',
      bass: null,
      bassPitch: null,
    });
    expect(parseChord('C/G')).toMatchObject({ root: 'C', suffix: '', bass: 'G', bassPitch: 7 });
    expect(parseChord('F#m7b5')).toMatchObject({ rootPitch: 6, suffix: 'm7b5' });
  });

  it('says nothing for what is not a chord', () => {
    expect(parseChord('N.C.')).toBeNull();
    expect(parseChord('Chorus')).toBeNull();
    expect(parseChord('')).toBeNull();
  });
});

describe('keyPrefersFlats', () => {
  it('spells the flat keys with flats and the others with sharps', () => {
    for (const key of ['F', 'Bb', 'Eb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm']) {
      expect(keyPrefersFlats(key), key).toBe(true);
    }
    for (const key of ['G', 'D', 'A', 'E', 'C', 'Am', 'Em', 'F#m', 'C#']) {
      expect(keyPrefersFlats(key), key).toBe(false);
    }
    expect(keyPrefersFlats('nonsense')).toBe(false);
  });
});

describe('transposeChord', () => {
  it('moves the root, keeps the suffix and moves the bass with it', () => {
    expect(transposeChord('Am7', 3, false)).toBe('Cm7');
    expect(transposeChord('C/G', 2, false)).toBe('D/A');
    expect(transposeChord('G', -2, true)).toBe('F');
  });

  it('spells as the key it moves to does', () => {
    expect(transposeChord('C', 1, false)).toBe('C#');
    expect(transposeChord('C', 1, true)).toBe('Db');
  });

  it('goes round the octave in both directions', () => {
    expect(transposeChord('B', 1, false)).toBe('C');
    expect(transposeChord('C', -1, false)).toBe('B');
    expect(transposeChord('C', 12, false)).toBe('C');
  });

  it('leaves what is not a chord alone', () => {
    expect(transposeChord('N.C.', 5, false)).toBe('N.C.');
  });
});

describe('transposeKey', () => {
  it('moves a major or a minor key', () => {
    expect(transposeKey('G', 2, false)).toBe('A');
    expect(transposeKey('Em', 3, true)).toBe('Gm');
    expect(transposeKey('F#m', -1, false)).toBe('Fm');
    expect(transposeKey('???', 2, false)).toBe('???');
  });
});

describe('transposeLyrics', () => {
  const lyrics = '{key: G}\n{sov: Verse 1}\n[G]Night de[Em]scends\n# [X] stays\n{eov}';

  it('moves every chord and the key, and never the words', () => {
    expect(transposeLyrics(lyrics, 2, false)).toBe(
      '{key: A}\n{sov: Verse 1}\n[A]Night de[F#m]scends\n# [X] stays\n{eov}',
    );
  });

  it('is the same text when moved by an octave or not at all', () => {
    expect(transposeLyrics(lyrics, 0, false)).toBe(lyrics);
    expect(transposeLyrics(lyrics, 12, false)).toBe(lyrics);
  });

  it('comes back to the start when moved there and back', () => {
    const there = transposeLyrics(lyrics, 5, false);

    expect(transposeLyrics(there, -5, false)).toBe(lyrics);
  });

  it('leaves a bracketed word that is not a chord, and keeps the line endings', () => {
    expect(transposeLyrics('[Chorus]\r\n[C]hi', 2, false)).toBe('[Chorus]\r\n[D]hi');
  });
});

describe('chordIntervals', () => {
  it('knows the common suffixes', () => {
    expect(chordIntervals('')).toEqual([0, 4, 7]);
    expect(chordIntervals('m')).toEqual([0, 3, 7]);
    expect(chordIntervals('7')).toEqual([0, 4, 7, 10]);
    expect(chordIntervals('maj7')).toEqual([0, 4, 7, 11]);
    expect(chordIntervals('m7')).toEqual([0, 3, 7, 10]);
    expect(chordIntervals('sus4')).toEqual([0, 5, 7]);
    expect(chordIntervals('dim')).toEqual([0, 3, 6]);
    expect(chordIntervals('5')).toEqual([0, 7]);
  });

  it('takes a plain triad for a suffix it does not know', () => {
    expect(chordIntervals('xyz')).toEqual([0, 4, 7]);
  });
});
