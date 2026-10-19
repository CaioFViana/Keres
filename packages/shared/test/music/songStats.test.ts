import { describe, expect, it } from 'vitest';
import { countLineSyllables } from '../../music/syllables';
import {
  estimateSongLength,
  parseMeter,
  quarterBeatsPerBar,
  syllableCounts,
} from '../../music/songStats';
import { chordProFileOf, readChordProFile } from '../../music/chordProFile';

describe('countLineSyllables', () => {
  it('counts what the writer marked, exactly, in any language', () => {
    expect(countLineSyllables('Ka·la·ne ru·sha', null)).toBe(5);
    expect(countLineSyllables('Ka·la·ne ru·sha', 'pt')).toBe(5);
  });

  it('estimates Portuguese by vowel groups, splitting two strong vowels', () => {
    expect(countLineSyllables('noite', 'pt')).toBe(2);
    expect(countLineSyllables('poema', 'pt')).toBe(3);
    expect(countLineSyllables('queijo', 'pt')).toBe(2);
    expect(countLineSyllables('A lua cheia', 'pt')).toBe(5);
  });

  it('estimates English by vowel groups, dropping a silent final e', () => {
    expect(countLineSyllables('night', 'en')).toBe(1);
    expect(countLineSyllables('descends', 'en')).toBe(2);
    expect(countLineSyllables('table', 'en')).toBe(2);
    expect(countLineSyllables('Amazing grace', 'en')).toBe(4);
  });

  it('counts a word that is only a few letters as one, and a line of nothing as none', () => {
    expect(countLineSyllables('the', 'en')).toBe(1);
    expect(countLineSyllables('', 'en')).toBe(0);
    expect(countLineSyllables('   ', 'pt')).toBe(0);
  });

  it('takes any language by its vowels when none is given', () => {
    expect(countLineSyllables('na ne ni', null)).toBe(3);
  });
});

describe('syllableCounts', () => {
  it('counts each lyric line, leaving chords, comments and directives out', () => {
    const lyrics = '{sov: Verse 1}\n[G]A lua [C]cheia\n{comment: slow}\n\nNoite\n{eov}';

    expect(syllableCounts(lyrics, 'pt')).toEqual([
      { text: 'A lua cheia', syllables: 5 },
      { text: 'Noite', syllables: 2 },
    ]);
  });
});

describe('parseMeter', () => {
  it('reads beats and unit, and falls back to 4/4', () => {
    expect(parseMeter('3/4')).toEqual({ beats: 3, unit: 4 });
    expect(parseMeter(' 6 / 8 ')).toEqual({ beats: 6, unit: 8 });
    expect(parseMeter('x')).toEqual({ beats: 4, unit: 4 });
    expect(parseMeter(null)).toEqual({ beats: 4, unit: 4 });
    expect(parseMeter('3/5')).toEqual({ beats: 4, unit: 4 });
  });

  it('counts the quarter notes in a bar', () => {
    expect(quarterBeatsPerBar('3/4')).toBe(3);
    expect(quarterBeatsPerBar('6/8')).toBe(3);
    expect(quarterBeatsPerBar(undefined)).toBe(4);
  });
});

describe('estimateSongLength', () => {
  it('takes a bar for each chord at the tempo and meter of the song', () => {
    const lyrics = '[G]a [C]b [D]c [G]d';

    expect(estimateSongLength({ lyrics, tempo: 120, meter: '4/4' })).toEqual({
      bars: 4,
      seconds: 8,
    });
    expect(estimateSongLength({ lyrics, tempo: 60, meter: '3/4' })).toEqual({
      bars: 4,
      seconds: 12,
    });
  });

  it('takes two bars a line when there are no chords', () => {
    expect(estimateSongLength({ lyrics: 'a\nb\nc', tempo: 120, meter: '4/4' })).toEqual({
      bars: 6,
      seconds: 12,
    });
  });

  it('takes a default tempo when there is none, and is nothing for no song', () => {
    expect(estimateSongLength({ lyrics: '[C]a', tempo: null, meter: null }).seconds).toBe(3);
    expect(estimateSongLength({ lyrics: '', tempo: 100, meter: '4/4' })).toEqual({
      bars: 0,
      seconds: 0,
    });
  });
});

describe('ChordPro files', () => {
  it('writes the facts of a song as directives above its lyrics', () => {
    const file = chordProFileOf({
      title: 'Tavern song',
      key: 'G',
      tempo: 90,
      meter: '3/4',
      lyrics: '{sov: Verse 1}\n[G]Night\n{eov}\n',
    });

    expect(file).toBe(
      '{title: Tavern song}\n{key: G}\n{time: 3/4}\n{tempo: 90}\n\n{sov: Verse 1}\n[G]Night\n{eov}\n',
    );
  });

  it('leaves out the facts a song does not have', () => {
    expect(
      chordProFileOf({ title: 'Plain', key: null, tempo: null, meter: null, lyrics: 'Words' }),
    ).toBe('{title: Plain}\n\nWords\n');
  });

  it('reads a file back into the song it was written from', () => {
    const song = {
      title: 'Tavern song',
      key: 'G',
      tempo: 90,
      meter: '3/4',
      lyrics: '{sov: Verse 1}\n[G]Night\n{eov}',
    };

    expect(readChordProFile(chordProFileOf(song))).toEqual(song);
  });

  it('keeps sections, comments and chords as written and takes the facts out of the lyrics', () => {
    const read = readChordProFile(
      '{title: Hymn}\n{subtitle: old}\n{capo: 2}\n# mine\n{start_of_chorus}\n[Am]Sing\n{end_of_chorus}\n',
    );

    expect(read.lyrics).toBe('# mine\n{start_of_chorus}\n[Am]Sing\n{end_of_chorus}');
    expect(read.title).toBe('Hymn');
    expect(read.key).toBeNull();
  });

  it('names a file with no title after the fallback', () => {
    expect(readChordProFile('[C]hi', 'From the file name').title).toBe('From the file name');
  });
});
