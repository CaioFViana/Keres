import { describe, expect, it } from 'vitest';
import {
  chordProFileOf,
  chordsOf,
  headingsToDirectives,
  parseChordPro,
  readSectionHeading,
  transposeLyrics,
} from '../../index';

describe('readSectionHeading', () => {
  it('reads a part named in square brackets, as anyone would write it', () => {
    expect(readSectionHeading('[Verse]')).toEqual({ kind: 'verse', label: null });
    expect(readSectionHeading('  [Chorus]  ')).toEqual({ kind: 'chorus', label: null });
    expect(readSectionHeading('[bridge]')).toEqual({ kind: 'bridge', label: null });
  });

  it('keeps the number a part was given, as written', () => {
    expect(readSectionHeading('[Verse 2]')).toEqual({ kind: 'verse', label: 'Verse 2' });
    expect(readSectionHeading('Chorus 1:')).toEqual({ kind: 'chorus', label: 'Chorus 1' });
  });

  it('reads the words of a Portuguese song too', () => {
    expect(readSectionHeading('[Refrão]')).toEqual({ kind: 'chorus', label: null });
    expect(readSectionHeading('Verso 2:')).toEqual({ kind: 'verse', label: 'Verso 2' });
    expect(readSectionHeading('[Ponte]')).toEqual({ kind: 'bridge', label: null });
  });

  it('reads a colon heading without brackets', () => {
    expect(readSectionHeading('Verse:')).toEqual({ kind: 'verse', label: null });
  });

  it('leaves chords, lyrics and directives alone', () => {
    expect(readSectionHeading('[G]')).toBeNull();
    expect(readSectionHeading('[Em7]')).toBeNull();
    expect(readSectionHeading('[Verse]Night falls')).toBeNull();
    expect(readSectionHeading('Verse of the night')).toBeNull();
    expect(readSectionHeading('{start_of_verse}')).toBeNull();
    expect(readSectionHeading('')).toBeNull();
  });
});

describe('a song with its parts named in brackets', () => {
  const text = [
    '[Verse]',
    'Sleep now, the glass is cold',
    '[Chorus]',
    'Hush, hush, the night is long',
    '[Verse]',
    'The city hums for you',
  ].join('\n');

  it('has the parts, in order, numbered like unlabelled sections', () => {
    const { sections } = parseChordPro(text);

    expect(sections.map((section) => [section.label, section.kind])).toEqual([
      ['Verse 1', 'verse'],
      ['Chorus', 'chorus'],
      ['Verse 2', 'verse'],
    ]);
  });

  it('takes the words of the work’s language for the numbering', () => {
    const { sections } = parseChordPro(text, { verse: 'Verso', chorus: 'Refrão', bridge: 'Ponte' });

    expect(sections.map((section) => section.label)).toEqual(['Verso 1', 'Refrão', 'Verso 2']);
  });

  it('keeps the lines of each part under it', () => {
    const { sections } = parseChordPro(text);

    expect(sections[0].lines).toHaveLength(1);
    expect(sections[1].lines).toHaveLength(1);
  });

  it('does not count the headings as chords', () => {
    expect(chordsOf(`[Bridge]\n[G]Night de[Em]scends`)).toEqual(['G', 'Em']);
  });

  it('does not move the headings when transposing', () => {
    expect(transposeLyrics('[Bridge]\n[G]Night de[Em]scends', 2, false)).toBe(
      '[Bridge]\n[A]Night de[F#m]scends',
    );
  });

  it('writes them as directives in a ChordPro file, for other programs to read', () => {
    expect(headingsToDirectives('[Verse 2]\nwords\n[Chorus]\nmore')).toBe(
      '{start_of_verse: Verse 2}\nwords\n{start_of_chorus}\nmore',
    );
    const file = chordProFileOf({
      title: 'Lullaby',
      key: null,
      tempo: null,
      meter: null,
      lyrics: '[Verse]\nSleep now',
    });
    expect(file).toContain('{start_of_verse}');
    expect(file).not.toContain('[Verse]');
  });
});
