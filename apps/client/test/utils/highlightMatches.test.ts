import { splitByTerm } from '../../src/utils/highlightMatches';

describe('splitByTerm', () => {
  it('marks the match and keeps what is around it', () => {
    expect(splitByTerm('The White Rabbit', 'rab')).toEqual([
      { text: 'The White ', match: false },
      { text: 'Rab', match: true },
      { text: 'bit', match: false },
    ]);
  });

  it('ignores case and keeps the text as written', () => {
    expect(splitByTerm('Alice', 'ALI')).toEqual([
      { text: 'Ali', match: true },
      { text: 'ce', match: false },
    ]);
  });

  it('marks every occurrence', () => {
    expect(splitByTerm('banana', 'an')).toEqual([
      { text: 'b', match: false },
      { text: 'an', match: true },
      { text: 'an', match: true },
      { text: 'a', match: false },
    ]);
  });

  it('marks the whole text when it is the term', () => {
    expect(splitByTerm('Alice', 'alice')).toEqual([{ text: 'Alice', match: true }]);
  });

  it('returns the text untouched without a term, or without a match', () => {
    expect(splitByTerm('Alice', '')).toEqual([{ text: 'Alice', match: false }]);
    expect(splitByTerm('Alice', '   ')).toEqual([{ text: 'Alice', match: false }]);
    expect(splitByTerm('Alice', undefined)).toEqual([{ text: 'Alice', match: false }]);
    expect(splitByTerm('Alice', 'zzz')).toEqual([{ text: 'Alice', match: false }]);
  });

  it('trims the term', () => {
    expect(splitByTerm('Alice', ' lic ')).toEqual([
      { text: 'A', match: false },
      { text: 'lic', match: true },
      { text: 'e', match: false },
    ]);
  });

  it('treats the term as text, not as a pattern', () => {
    expect(splitByTerm('a.c abc', 'a.c')).toEqual([
      { text: 'a.c', match: true },
      { text: ' abc', match: false },
    ]);
  });

  it('handles empty text', () => {
    expect(splitByTerm('', 'a')).toEqual([{ text: '', match: false }]);
  });
});
