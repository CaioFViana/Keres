import { describe, expect, it } from 'vitest';
import { parseChordPro } from '../../music/chordpro';
import {
  duplicateSectionLabels,
  numberDuplicateSections,
  plainLines,
  sectionLabels,
  songExcerpt,
} from '../../music/sections';

const lyrics = [
  '{sov: Verse 1}',
  'One',
  '{eov}',
  '{soc: Chorus}',
  'Sing',
  '{eoc}',
  '{sov: Verse 2}',
  'Two',
  '{eov}',
].join('\n');

describe('sectionLabels', () => {
  it('lists the labels in the order written', () => {
    expect(sectionLabels(lyrics)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
  });

  it('has none for lyrics with no sections', () => {
    expect(sectionLabels('Just words')).toEqual([]);
  });
});

describe('duplicateSectionLabels', () => {
  it('finds a label written twice', () => {
    expect(duplicateSectionLabels('{sov: Verse}\na\n{eov}\n{sov: Verse}\nb\n{eov}')).toEqual([
      'Verse',
    ]);
  });

  it('finds nothing when every label is its own', () => {
    expect(duplicateSectionLabels(lyrics)).toEqual([]);
  });
});

describe('numberDuplicateSections', () => {
  it('numbers sections that share a label, in the order they stand', () => {
    const text = '{sov: Verse}\na\n{eov}\n{soc: Chorus}\nc\n{eoc}\n{sov: Verse}\nb\n{eov}';

    expect(numberDuplicateSections(text)).toBe(
      '{sov: Verse 1}\na\n{eov}\n{soc: Chorus}\nc\n{eoc}\n{sov: Verse 2}\nb\n{eov}',
    );
  });

  it('leaves text with no repeated label exactly as it is', () => {
    expect(numberDuplicateSections(lyrics)).toBe(lyrics);
  });

  it('keeps the short name of the directive it rewrites', () => {
    expect(numberDuplicateSections('{sov: V}\na\n{eov}\n{sov: V}\nb\n{eov}')).toContain(
      '{sov: V 2}',
    );
  });

  it('leaves no repeated label behind', () => {
    const fixed = numberDuplicateSections('{sov}\na\n{eov}\n{sov: Verse}\nb\n{eov}');

    expect(duplicateSectionLabels(fixed)).toEqual([]);
  });
});

describe('songExcerpt', () => {
  const song = parseChordPro(lyrics);

  it('is the whole song when no section is named', () => {
    const excerpt = songExcerpt(song, null);

    expect(excerpt.sections).toHaveLength(3);
    expect(excerpt.wholeSong).toBe(true);
    expect(songExcerpt(song, []).wholeSong).toBe(true);
  });

  it('keeps the named sections, in the order they stand in the song', () => {
    const excerpt = songExcerpt(song, ['Verse 2', 'Chorus']);

    expect(excerpt.sections.map((section) => section.label)).toEqual(['Chorus', 'Verse 2']);
    expect(excerpt.found).toEqual(['Chorus', 'Verse 2']);
    expect(excerpt.missing).toEqual([]);
    expect(excerpt.wholeSong).toBe(false);
  });

  it('keeps what is still there and says what is not', () => {
    const excerpt = songExcerpt(song, ['Chorus', 'Coro']);

    expect(excerpt.sections.map((section) => section.label)).toEqual(['Chorus']);
    expect(excerpt.missing).toEqual(['Coro']);
    expect(excerpt.wholeSong).toBe(false);
  });

  it('prints the whole song when none of the named sections is left', () => {
    const excerpt = songExcerpt(song, ['Coro']);

    expect(excerpt.sections).toHaveLength(3);
    expect(excerpt.missing).toEqual(['Coro']);
    expect(excerpt.wholeSong).toBe(true);
  });
});

describe('plainLines', () => {
  it('writes the lyrics without chords or syllable marks, a recall as its label, a comment as it is', () => {
    const [section] = parseChordPro(
      '{soc: Chorus}\n[G]No·ite [Em]cai\n{chorus: Chorus}\n{comment: twice}\n{eoc}',
    ).sections;

    expect(plainLines(section, (label) => `(${label ?? 'again'})`)).toEqual([
      'Noite cai',
      '(Chorus)',
      'twice',
    ]);
  });

  it('can keep the syllable marks', () => {
    const [section] = parseChordPro('{sov: V}\nNo·ite\n{eov}').sections;

    expect(plainLines(section, () => '', true)).toEqual(['No·ite']);
  });
});
