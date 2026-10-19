import { describe, expect, it } from 'vitest';
import { parseChordPro } from '../../music/chordpro';
import { parseMelody } from '../../music/melody';
import { buildTimeline, type TimelineOptions } from '../../music/timeline';

const options: TimelineOptions = { language: 'en', tempo: 120, meter: '4/4' };
const timeline = (lyrics: string, tune: string, extra: Partial<TimelineOptions> = {}) =>
  buildTimeline(parseChordPro(lyrics), parseMelody(tune), { ...options, ...extra });
const spans = (lyrics: string, tune: string, extra: Partial<TimelineOptions> = {}) =>
  timeline(lyrics, tune, extra).chords.map((c) => [c.symbol, c.start, c.end]);

describe('the chords of a timeline', () => {
  it('puts each chord on the syllable it is written over and holds it to the next', () => {
    expect(spans('{sov: V}\n[G]One [C]two three [D]four\n{eov}', 'C D E F')).toEqual([
      ['G', 0, 1],
      ['C', 1, 3],
      ['D', 3, 4],
    ]);
  });

  it('holds the last chord of a section to the end of its bar', () => {
    expect(spans('{sov: V}\n[G]One two three\n{eov}', 'C D E')).toEqual([['G', 0, 4]]);
  });

  it('lets a chord carry on into the next line of the same section', () => {
    expect(spans('{sov: V}\n[G]One two\nThree [C]four\n{eov}', 'C D E F')).toEqual([
      ['G', 0, 3],
      ['C', 3, 4],
    ]);
  });

  it('follows the tune where it is longer than a bar', () => {
    expect(spans('{sov: V}\n[G]One [C]two\n{eov}', 'C2 D4')).toEqual([
      ['G', 0, 2],
      ['C', 2, 8],
    ]);
  });

  it('says nothing for a song without chords', () => {
    expect(timeline('{sov: V}\nOne two\n{eov}', 'C D').chords).toEqual([]);
  });

  it('skips a chord that falls past the last note of a tune short of its words', () => {
    expect(spans('{sov: V}\n[G]One two [C]three four\n{eov}', 'C D')).toEqual([['G', 0, 4]]);
  });

  it('sounds only the last of two chords written on one syllable', () => {
    expect(spans('{sov: V}\n[G][C]One two\n{eov}', 'C D')).toEqual([['C', 0, 4]]);
  });

  it('lays a section with chords and no tune out one bar to a chord', () => {
    const result = timeline('{sov: V}\n[G]One two\n[C]Three four\n{eov}', '');

    expect(result.chords.map((c) => [c.symbol, c.start, c.end])).toEqual([
      ['G', 0, 4],
      ['C', 4, 8],
    ]);
    expect(result.notes).toEqual([]);
    expect(result.beats).toBe(8);
    expect(result.seconds).toBe(4);
  });

  it('shares the bars of a section with no tune between its lines, so the words can follow', () => {
    const result = timeline('{sov: V}\n[G]One two\n[C]Three four\n{eov}', '');

    expect(result.lines.map((l) => [l.text, l.start, l.end])).toEqual([
      ['One two', 0, 4],
      ['Three four', 4, 8],
    ]);
  });

  it('takes the tune of a section where there is one, and the bars where there is not', () => {
    const lyrics =
      '{sov: Verse 1}\n[G]One two [C]three four\n{eov}\n{soc: Chorus}\n[Am]La [F]la\n{eoc}';
    const result = timeline(lyrics, 'P:Verse 1\nC D E F');

    expect(result.chords.map((c) => [c.symbol, c.start, c.end])).toEqual([
      ['G', 0, 2],
      ['C', 2, 4],
      ['Am', 4, 8],
      ['F', 8, 12],
    ]);
  });

  it('plays a section with words and neither chords nor tune as nothing', () => {
    expect(timeline('{sov: V}\nOne two\n{eov}', '').beats).toBe(0);
  });

  it('keeps to one section when asked, from its own start', () => {
    const lyrics = '{sov: A}\n[G]One two\n{eov}\n{soc: B}\n[C]Three four\n{eoc}';

    expect(spans(lyrics, '', { onlySection: 1 })).toEqual([['C', 0, 4]]);
  });

  it('keeps several sections when asked, from the start, in the order of the song', () => {
    const lyrics =
      '{sov: A}\n[G]One two\n{eov}\n{soc: B}\n[C]Three four\n{eoc}\n{sov: C}\n[D]Five six\n{eov}';

    // The sections come out in the order the song has them, whatever order they were asked in.
    expect(spans(lyrics, '', { onlySections: [2, 0] })).toEqual([
      ['G', 0, 4],
      ['D', 4, 8],
    ]);
  });

  it('cuts the chords with the time, the way it cuts the notes', () => {
    const lyrics = '{sov: A}\n[G]One [C]two [D]three [E]four\n{eov}';
    const result = timeline(lyrics, 'C D E F', { maxSeconds: 1 });

    expect(result.chords.map((c) => [c.symbol, c.start, c.end])).toEqual([
      ['G', 0, 1],
      ['C', 1, 2],
    ]);
  });

  it('plays the chords of a chorus again where the words say {chorus}', () => {
    const lyrics =
      '{sov: Verse 1}\n[G]One two\n{eov}\n{soc: Chorus}\n[C]La la\n{eoc}\n{sov: Verse 2}\n[G]Three four\n{chorus}\n{eov}';
    const result = timeline(lyrics, 'P:Verse 1\nC D\nP:Chorus\ng a');

    expect(result.chords.map((c) => c.symbol)).toEqual(['G', 'C', 'G', 'C']);
  });
});
