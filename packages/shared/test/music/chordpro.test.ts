import { describe, expect, it } from 'vitest';
import {
  chordsOf,
  lyricLinesOf,
  lyricText,
  parseChordPro,
  parseLyricLine,
  readDirective,
} from '../../music/chordpro';

describe('readDirective', () => {
  it('reads a directive with a value after a colon or a space', () => {
    expect(readDirective('{title: Tavern song}')).toEqual({ name: 'title', value: 'Tavern song' });
    expect(readDirective('  {key G}  ')).toEqual({ name: 'key', value: 'G' });
    expect(readDirective('{start_of_chorus}')).toEqual({ name: 'start_of_chorus', value: '' });
  });

  it('reads the name in lowercase and says nothing for a line that is not a directive', () => {
    expect(readDirective('{TITLE: x}')?.name).toBe('title');
    expect(readDirective('Night [G]falls')).toBeNull();
    expect(readDirective('{broken')).toBeNull();
    expect(readDirective('')).toBeNull();
  });
});

describe('parseLyricLine', () => {
  it('cuts a line at its chords, each on the syllable that follows', () => {
    expect(parseLyricLine('[G]Night de[Em]scends')).toEqual([
      { chord: 'G', text: 'Night de' },
      { chord: 'Em', text: 'scends' },
    ]);
  });

  it('keeps words before the first chord with no chord', () => {
    expect(parseLyricLine('Oh [C]my')).toEqual([
      { chord: null, text: 'Oh ' },
      { chord: 'C', text: 'my' },
    ]);
  });

  it('keeps a chord with no words after it, and a line with no chords whole', () => {
    expect(parseLyricLine('Hold [D]')).toEqual([
      { chord: null, text: 'Hold ' },
      { chord: 'D', text: '' },
    ]);
    expect(parseLyricLine('Just words')).toEqual([{ chord: null, text: 'Just words' }]);
    expect(parseLyricLine('')).toEqual([{ chord: null, text: '' }]);
  });

  it('ignores an empty pair of brackets', () => {
    expect(parseLyricLine('A[]b')).toEqual([
      { chord: null, text: 'A' },
      { chord: null, text: 'b' },
    ]);
  });
});

describe('lyricText', () => {
  it("is the words with no chords, and without the writer's syllable marks unless asked", () => {
    const segments = parseLyricLine('No·[G]ite');

    expect(lyricText(segments)).toBe('Noite');
    expect(lyricText(segments, true)).toBe('No·ite');
  });
});

describe('parseChordPro', () => {
  const song = [
    '{title: Tavern song}',
    '{key: G}',
    '{tempo: 90}',
    '{time: 3/4}',
    '{capo: 2}',
    '# the writer keeps this',
    '{start_of_verse: Verse 1}',
    '[G]Night de[Em]scends',
    '{end_of_verse}',
    '',
    '{start_of_chorus: Chorus}',
    'Sing it [C]loud',
    '{chorus}',
    '{comment: twice}',
    '{end_of_chorus}',
  ].join('\n');

  it('reads the facts of the song', () => {
    expect(parseChordPro(song).meta).toEqual({
      title: 'Tavern song',
      subtitle: null,
      key: 'G',
      tempo: 90,
      time: '3/4',
      capo: 2,
    });
  });

  it('reads each section with its label and kind, in order', () => {
    const { sections } = parseChordPro(song);

    expect(sections.map((section) => [section.label, section.kind])).toEqual([
      ['Verse 1', 'verse'],
      ['Chorus', 'chorus'],
    ]);
    expect(lyricLinesOf(sections[0])).toEqual([
      [
        { chord: 'G', text: 'Night de' },
        { chord: 'Em', text: 'scends' },
      ],
    ]);
  });

  it('keeps a recall and a comment as lines of the section they stand in', () => {
    const chorus = parseChordPro(song).sections[1];

    expect(chorus.lines.map((line) => line.kind)).toEqual(['lyric', 'recall', 'comment']);
    expect(chorus.lines[2]).toEqual({ kind: 'comment', text: 'twice', italic: false });
  });

  it('reads an italic comment, and the short names of the directives', () => {
    const parsed = parseChordPro('{t: Short}\n{st: Sub}\n{sov}\n{ci: softly}\n{eov}');

    expect(parsed.meta.title).toBe('Short');
    expect(parsed.meta.subtitle).toBe('Sub');
    expect(parsed.sections[0].lines).toEqual([{ kind: 'comment', text: 'softly', italic: true }]);
  });

  it('names an unlabelled section after its kind, numbered when several share it', () => {
    const parsed = parseChordPro(
      '{sov}\na\n{eov}\n{soc}\nb\n{eoc}\n{sov}\nc\n{eov}\n{sob}\nd\n{eob}',
    );

    expect(parsed.sections.map((section) => section.label)).toEqual([
      'Verse 1',
      'Chorus',
      'Verse 2',
      'Bridge',
    ]);
  });

  it('names an unlabelled section in the words it is given', () => {
    const parsed = parseChordPro('{sov}\na\n{eov}\n{soc}\nb\n{eoc}', {
      verse: 'Verso',
      chorus: 'Refrão',
      bridge: 'Ponte',
    });

    expect(parsed.sections.map((section) => section.label)).toEqual(['Verso', 'Refrão']);
  });

  it('keeps text outside any section as a section with no label, so nothing written is lost', () => {
    const parsed = parseChordPro('Before\n\n{sov: One}\nInside\n{eov}\n\nAfter');

    expect(parsed.sections.map((section) => section.label)).toEqual([null, 'One', null]);
    expect(parsed.sections.map((section) => section.kind)).toEqual(['none', 'verse', 'none']);
  });

  it('closes a section the next one opens on, with no end written', () => {
    const parsed = parseChordPro('{sov: One}\na\n{sov: Two}\nb');

    expect(parsed.sections.map((section) => section.label)).toEqual(['One', 'Two']);
  });

  it('closes the last section at the end of the text', () => {
    expect(parseChordPro('{soc: Chorus}\nSing').sections).toHaveLength(1);
  });

  it("skips a directive it does not know, and a comment line of the writer's own", () => {
    const parsed = parseChordPro('{define: Am base-fret 1}\n# private\nWords');

    expect(parsed.sections[0].lines).toEqual([
      { kind: 'lyric', segments: [{ chord: null, text: 'Words' }] },
    ]);
  });

  it('trims the blank lines around a section but keeps those between its stanzas', () => {
    const parsed = parseChordPro('{sov: One}\n\na\n\nb\n\n{eov}');

    expect(parsed.sections[0].lines.map((line) => line.kind)).toEqual(['lyric', 'blank', 'lyric']);
  });

  it('reads Windows line endings and an empty text', () => {
    expect(parseChordPro('{sov: One}\r\na\r\n{eov}').sections[0].lines).toHaveLength(1);
    expect(parseChordPro('').sections).toEqual([]);
  });

  it('ignores a tempo or a capo that is not a number', () => {
    const { meta } = parseChordPro('{tempo: fast}\n{capo: high}');

    expect(meta.tempo).toBeNull();
    expect(meta.capo).toBeNull();
  });
});

describe('chordsOf', () => {
  it('lists the chords in order, as written, leaving directives and comments out', () => {
    expect(chordsOf('{key: [G]}\n# [X]\n[G]Hi [Em]there\n[C]Again')).toEqual(['G', 'Em', 'C']);
  });
});
