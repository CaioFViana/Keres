import { describe, expect, it } from 'vitest';
import {
  excerptAroundMatch,
  findAllCaseInsensitiveMatches,
  findFirstExcerptMatch,
  splitTextByActiveRanges,
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

describe('excerptAroundMatch', () => {
  it('returns short texts untouched', () => {
    expect(excerptAroundMatch('Alice arrives.', { start: 0, length: 5 }, 150)).toBe(
      'Alice arrives.',
    );
    expect(excerptAroundMatch('x'.repeat(150), { start: 0, length: 1 }, 150)).toBe('x'.repeat(150));
  });

  it('centers a mid-text match with an ellipsis on each cut side', () => {
    const text = `${'lorem '.repeat(40)}Alice${' ipsum'.repeat(40)}`;
    const at = text.indexOf('Alice');
    const excerpt = excerptAroundMatch(text, { start: at, length: 5 }, 60);

    expect(excerpt.startsWith('…')).toBe(true);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt).toContain('Alice');
    expect(excerpt.length).toBeLessThanOrEqual(62);
    // Roughly centered: the match sits away from both edges of the window.
    const inner = excerpt.slice(1, -1);
    expect(inner.indexOf('Alice')).toBeGreaterThan(10);
  });

  it('omits the leading ellipsis when the match opens the text', () => {
    const text = `Alice ${'lorem '.repeat(40)}`;
    const excerpt = excerptAroundMatch(text, { start: 0, length: 5 }, 60);

    expect(excerpt.startsWith('…')).toBe(false);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt).toContain('Alice');
  });

  it('omits the trailing ellipsis when the match closes the text', () => {
    const text = `${'lorem '.repeat(40)}Alice`;
    const excerpt = excerptAroundMatch(text, { start: text.length - 5, length: 5 }, 60);

    expect(excerpt.startsWith('…')).toBe(true);
    expect(excerpt.endsWith('…')).toBe(false);
    expect(excerpt).toContain('Alice');
  });

  it('opens at the match when the match itself overflows the window', () => {
    const text = `aaa ${'b'.repeat(80)} ccc`;
    const excerpt = excerptAroundMatch(text, { start: 4, length: 80 }, 60);

    expect(excerpt.startsWith('…')).toBe(true);
    expect(excerpt.slice(1, 61)).toBe('b'.repeat(60));
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
    ).toEqual([{ text: 'hi', marked: false }]);
    // The first range clamps to an empty span at 0, so nothing is marked.
    expect(splitTextByRanges('hi', [{ start: 1, length: 99 }])).toEqual([
      { text: 'h', marked: false },
      { text: 'i', marked: true },
    ]);
  });
});

describe('splitTextByActiveRanges', () => {
  it('flags only the segments an active range touches', () => {
    expect(
      splitTextByActiveRanges(
        'Waves. Waves again.',
        [
          { start: 0, length: 5 },
          { start: 7, length: 5 },
        ],
        [{ start: 7, length: 5 }],
      ),
    ).toEqual([
      { text: 'Waves', marked: true, active: false },
      { text: '. ', marked: false, active: false },
      { text: 'Waves', marked: true, active: true },
      { text: ' again.', marked: false, active: false },
    ]);
  });

  it('marks everything inactive without active ranges', () => {
    expect(splitTextByActiveRanges('Waves.', [{ start: 0, length: 5 }], [])).toEqual([
      { text: 'Waves', marked: true, active: false },
      { text: '.', marked: false, active: false },
    ]);
  });

  it('flags a marked segment the active range only touches', () => {
    const segments = splitTextByActiveRanges(
      'Waves.',
      [{ start: 0, length: 5 }],
      [{ start: 3, length: 5 }],
    );
    expect(segments[0]).toEqual({ text: 'Waves', marked: true, active: true });
  });
});
