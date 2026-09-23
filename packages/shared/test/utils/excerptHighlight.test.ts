import { describe, expect, it } from 'vitest';
import {
  parseInlineLine,
  stripInlineMarkup,
  stripMarkdownText,
} from '../../manuscript/ManuscriptDocument';
import {
  collapseWhitespace,
  excerptAroundMatch,
  findAllCaseInsensitiveMatches,
  findFirstExcerptMatch,
  frameMatchWindow,
  sliceMatchAcrossSpans,
  splitTextByActiveRanges,
  splitTextByCommentRanges,
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

describe('stripInlineMarkup', () => {
  it('renders exactly what the inline grammar parses', () => {
    const lines = [
      'A **bold** word.',
      '**__nest__**',
      '***both***',
      '****',
      '**open',
      'a \\* b',
      '2 * 3',
      '__u__ and ~~s~~',
      '*i* x *j*',
      'plain',
      '',
      '**a ****',
      '*a **** b*',
    ];
    for (const line of lines) {
      const rendered = parseInlineLine(line)
        .map((span) => span.text)
        .join('');
      expect(stripInlineMarkup(line)).toBe(rendered);
    }
  });
});

describe('stripMarkdownText', () => {
  it('strips each line while preserving newlines byte-identically', () => {
    expect(stripMarkdownText('A **bold** word.\n\nSecond *line*.')).toBe(
      'A bold word.\n\nSecond line.',
    );
  });

  it('never lets markup span a line break', () => {
    expect(stripMarkdownText('**open\nclose**')).toBe('**open\nclose**');
  });

  it('leaves plain text and empties untouched', () => {
    expect(stripMarkdownText('Just prose.')).toBe('Just prose.');
    expect(stripMarkdownText('')).toBe('');
  });
});

describe('collapseWhitespace', () => {
  it('reads every whitespace run as one flowing space', () => {
    expect(collapseWhitespace('a\n\nb')).toBe('a b');
    expect(collapseWhitespace('a\r\nb')).toBe('a b');
    expect(collapseWhitespace('a\tb')).toBe('a b');
    expect(collapseWhitespace('  padded  ')).toBe('padded');
    expect(collapseWhitespace('')).toBe('');
  });
});

describe('sliceMatchAcrossSpans', () => {
  it('slices a block match into per-span local ranges', () => {
    expect(
      sliceMatchAcrossSpans(['A ', 'bold', ' word.'], { start: 2, length: 9 }),
    ).toEqual([[], [{ start: 0, length: 4 }], [{ start: 0, length: 5 }]]);
  });

  it('keeps a within-span match on its own span', () => {
    expect(sliceMatchAcrossSpans(['abc', 'def'], { start: 1, length: 2 })).toEqual([
      [{ start: 1, length: 2 }],
      [],
    ]);
  });

  it('returns empties where the match does not reach', () => {
    expect(sliceMatchAcrossSpans(['abc', 'def'], { start: 10, length: 2 })).toEqual([[], []]);
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

describe('frameMatchWindow', () => {
  it('passes short texts through with the match untouched', () => {
    expect(frameMatchWindow('Alice arrives.', { start: 0, length: 5 }, 150)).toEqual({
      text: 'Alice arrives.',
      match: { start: 0, length: 5 },
    });
  });

  it('relocates a mid-text match into its framed window', () => {
    const text = `${'lorem '.repeat(40)}Alice${' ipsum'.repeat(40)}`;
    const framed = frameMatchWindow(text, { start: text.indexOf('Alice'), length: 5 }, 60);

    expect(framed.text).toBe(
      excerptAroundMatch(text, { start: text.indexOf('Alice'), length: 5 }, 60),
    );
    expect(framed.text.startsWith('…')).toBe(true);
    expect(framed.text.endsWith('…')).toBe(true);
    expect(framed.text.slice(framed.match.start, framed.match.start + framed.match.length)).toBe(
      'Alice',
    );
  });

  it('drops the ellipsis on the side the window never cuts', () => {
    const head = frameMatchWindow(`Alice ${'lorem '.repeat(40)}`, { start: 0, length: 5 }, 60);
    expect(head.text.startsWith('…')).toBe(false);
    expect(head.text.slice(head.match.start, head.match.start + head.match.length)).toBe('Alice');

    const tailText = `${'lorem '.repeat(40)}Alice`;
    const tail = frameMatchWindow(tailText, { start: tailText.length - 5, length: 5 }, 60);
    expect(tail.text.endsWith('…')).toBe(false);
    expect(tail.text.slice(tail.match.start, tail.match.start + tail.match.length)).toBe('Alice');
  });

  it('clamps an overflowing match to its visible part', () => {
    const text = `aaa ${'b'.repeat(80)} ccc`;
    const framed = frameMatchWindow(text, { start: 4, length: 80 }, 60);

    expect(framed.text.slice(framed.match.start, framed.match.start + framed.match.length)).toBe(
      'b'.repeat(60),
    );
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

describe('splitTextByCommentRanges', () => {
  it('marks the union and flags commented segments', () => {
    expect(
      splitTextByCommentRanges(
        'Waves crash loudly.',
        [{ start: 0, length: 5 }],
        [{ start: 6, length: 5 }],
      ),
    ).toEqual([
      { text: 'Waves', marked: true, active: false, comment: false },
      { text: ' ', marked: false, active: false, comment: false },
      { text: 'crash', marked: true, active: false, comment: true },
      { text: ' loudly.', marked: false, active: false, comment: false },
    ]);
  });

  it('merges an overlap into one segment with both flags', () => {
    const segments = splitTextByCommentRanges(
      'Waves.',
      [{ start: 0, length: 5 }],
      [{ start: 0, length: 5 }],
      [{ start: 0, length: 5 }],
    );
    expect(segments[0]).toEqual({ text: 'Waves', marked: true, active: true, comment: true });
  });

  it('renders plain text as one unmarked segment', () => {
    expect(splitTextByCommentRanges('Waves.', [], [])).toEqual([
      { text: 'Waves.', marked: false, active: false, comment: false },
    ]);
  });
});
