import { describe, expect, it } from 'vitest';
import {
  findAllCaseInsensitiveMatches,
  findFirstExcerptMatch,
  splitTextByRanges,
} from '../../utils/excerptHighlight';

describe('findFirstExcerptMatch', () => {
  it('finds an exact match with original offsets', () => {
    expect(findFirstExcerptMatch('A quiet arrival at dawn', 'quiet arrival')).toEqual({
      start: 2,
      length: 13,
    });
  });

  it('matches case-insensitively', () => {
    expect(findFirstExcerptMatch('A Quiet Arrival', 'quiet arrival')).toEqual({
      start: 2,
      length: 13,
    });
  });

  it('matches accent-insensitively', () => {
    // 'manha' anchors 'manhã': the returned span covers the original accented text.
    const match = findFirstExcerptMatch('Eles chegaram de manhã cedo', 'manha');
    expect(match).toEqual({ start: 17, length: 5 });
    expect('Eles chegaram de manhã cedo'.slice(match!.start, match!.start + match!.length)).toBe(
      'manhã',
    );
  });

  it('matches accents on both sides at once', () => {
    expect(findFirstExcerptMatch('MANHÃ DE DOMINGO', 'manha')).toEqual({ start: 0, length: 5 });
    expect(findFirstExcerptMatch('uma manha comum', 'MANHÃ')).toEqual({ start: 4, length: 5 });
  });

  it('keeps original offsets when accented text precedes the match', () => {
    const source = 'àáâ first second first';
    const match = findFirstExcerptMatch(source, 'first');
    expect(match).toEqual({ start: 4, length: 5 });
    expect(source.slice(match!.start, match!.start + match!.length)).toBe('first');
  });

  it('returns the FIRST occurrence when the excerpt repeats', () => {
    expect(findFirstExcerptMatch('Waves. Waves again.', 'waves')).toEqual({ start: 0, length: 5 });
  });

  it('returns null when the excerpt is missing', () => {
    expect(findFirstExcerptMatch('A quiet arrival', 'stale words')).toBeNull();
  });

  it('returns null for an empty, blank, or absent excerpt', () => {
    expect(findFirstExcerptMatch('A quiet arrival', '')).toBeNull();
    expect(findFirstExcerptMatch('A quiet arrival', '   ')).toBeNull();
    expect(findFirstExcerptMatch('A quiet arrival', null)).toBeNull();
    expect(findFirstExcerptMatch('A quiet arrival', undefined)).toBeNull();
  });

  it('returns null for an empty source', () => {
    expect(findFirstExcerptMatch('', 'quiet')).toBeNull();
  });

  it('ignores surrounding whitespace pasted with the excerpt', () => {
    expect(findFirstExcerptMatch('A quiet arrival', '  quiet  ')).toEqual({ start: 2, length: 5 });
  });
});

describe('findAllCaseInsensitiveMatches', () => {
  it('returns every non-overlapping match with offsets', () => {
    expect(findAllCaseInsensitiveMatches('Waves. Waves again.', 'waves')).toEqual([
      { start: 0, length: 5 },
      { start: 7, length: 5 },
    ]);
  });

  it('matches case-insensitively', () => {
    expect(findAllCaseInsensitiveMatches('Opening', 'OPEN')).toEqual([{ start: 0, length: 4 }]);
  });

  it('stays accent-sensitive like manuscript search', () => {
    // Search matching semantics are case-insensitive only: 'manha' must NOT anchor 'manhã'.
    expect(findAllCaseInsensitiveMatches('chegaram de manhã', 'manha')).toEqual([]);
  });

  it('returns no ranges for an empty, blank, or absent query', () => {
    expect(findAllCaseInsensitiveMatches('Waves.', '')).toEqual([]);
    expect(findAllCaseInsensitiveMatches('Waves.', '   ')).toEqual([]);
    expect(findAllCaseInsensitiveMatches('Waves.', null)).toEqual([]);
    expect(findAllCaseInsensitiveMatches('Waves.', undefined)).toEqual([]);
  });

  it('returns no ranges when the query is absent', () => {
    expect(findAllCaseInsensitiveMatches('Waves.', 'zzz')).toEqual([]);
  });
});

describe('splitTextByRanges', () => {
  it('returns the whole text unmarked without ranges', () => {
    expect(splitTextByRanges('hello', [])).toEqual([{ text: 'hello', marked: false }]);
  });

  it('splits one range into before, marked, and after', () => {
    expect(splitTextByRanges('A quiet arrival', [{ start: 2, length: 5 }])).toEqual([
      { text: 'A ', marked: false },
      { text: 'quiet', marked: true },
      { text: ' arrival', marked: false },
    ]);
  });

  it('handles edge-anchored ranges without empty segments', () => {
    expect(splitTextByRanges('Waves.', [{ start: 0, length: 5 }])).toEqual([
      { text: 'Waves', marked: true },
      { text: '.', marked: false },
    ]);
  });

  it('clamps out-of-bounds ranges and drops empty ones', () => {
    expect(
      splitTextByRanges('hi', [
        { start: -4, length: 3 },
        { start: 5, length: 2 },
        { start: 1, length: 0 },
      ]),
    ).toEqual([
      { text: 'hi', marked: false },
    ]);
    // The first range clamps to an empty span at 0, so nothing is marked.
    expect(splitTextByRanges('hi', [{ start: 1, length: 99 }])).toEqual([
      { text: 'h', marked: false },
      { text: 'i', marked: true },
    ]);
  });
});
