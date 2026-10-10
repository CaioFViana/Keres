import { describe, expect, it } from 'vitest';
import { insertBlockAt, sectionBlock, sectionInsertionPoint } from '../../music/sections';

describe('sectionInsertionPoint', () => {
  const song =
    '{start_of_verse: Verse 1}\nOne\nTwo\n{end_of_verse}\n\n{start_of_chorus}\nLa\n{end_of_chorus}\n';
  const afterLine = (text: string, line: string) => text.indexOf(line) + line.length + 1;

  it('keeps the cursor where it is outside any section', () => {
    expect(sectionInsertionPoint(song, 0)).toBe(0);
    const between = song.indexOf('\n\n{start_of_chorus}') + 1;
    expect(sectionInsertionPoint(song, between)).toBe(between);
    expect(sectionInsertionPoint(song, song.length)).toBe(song.length);
    expect(sectionInsertionPoint('Just words', 4)).toBe(4);
  });

  it('moves a cursor inside a section to the line after its end', () => {
    const afterVerse = afterLine(song, '{end_of_verse}');
    expect(sectionInsertionPoint(song, song.indexOf('One'))).toBe(afterVerse);
    expect(sectionInsertionPoint(song, song.indexOf('Two') + 2)).toBe(afterVerse);
    expect(sectionInsertionPoint(song, song.indexOf('La'))).toBe(
      afterLine(song, '{end_of_chorus}'),
    );
  });

  it('reads the short directives too', () => {
    const short = '{sov: Verse 1}\nOne\n{eov}\n';
    expect(sectionInsertionPoint(short, short.indexOf('One'))).toBe(short.length);
  });

  it('puts a section added from inside an empty one after it, never in it', () => {
    const open = sectionBlock('verse', 'Verse 1');
    const inside = open.indexOf('\n') + 1;
    const next = insertBlockAt(
      open,
      sectionInsertionPoint(open, inside),
      sectionBlock('chorus', 'Chorus'),
    );

    expect(next.indexOf('{start_of_chorus')).toBeGreaterThan(next.indexOf('{end_of_verse}'));
  });

  it('runs a section left open to the end of the text', () => {
    const open = '{start_of_verse}\nOne';
    expect(sectionInsertionPoint(open, 20)).toBe(open.length);
  });
});
