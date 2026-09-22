import { describe, expect, it } from 'vitest';
import {
  documentTextContent,
  isEmptyManuscriptDocument,
  normalizeManuscriptDocument,
  normalizeManuscriptSpans,
  parseMarkdownToDocument,
  serializeDocumentToMarkdown,
} from '../../manuscript/ManuscriptDocument';
import type {
  ManuscriptBlock,
  ManuscriptDocument,
  ManuscriptMark,
} from '../../manuscript/ManuscriptDocument';

function paragraph(text: string, marks: ManuscriptMark[] = []): ManuscriptBlock {
  return { kind: 'paragraph', spans: [{ text, marks }] };
}

/**
 * Semantic comparison: span segmentation is an encoding detail (a bold
 * `a\\nb` round-trips as two bold lines around a newline), so docs compare by
 * per-character marks, not by span arrays.
 */
function charMarks(doc: ManuscriptDocument) {
  return doc.blocks.map((block) => ({
    kind: block.kind,
    chars: block.spans.flatMap((span) =>
      [...span.text].map((char) => ({ char, marks: [...span.marks].sort() })),
    ),
  }));
}

describe('normalizeManuscriptSpans', () => {
  it('sorts, dedupes, merges and drops empties', () => {
    expect(
      normalizeManuscriptSpans([
        { text: '', marks: ['bold'] },
        { text: 'a', marks: ['italic', 'bold', 'bold'] },
        { text: 'b', marks: ['bold', 'italic'] },
        { text: 'c', marks: [] },
      ]),
    ).toEqual([
      { text: 'ab', marks: ['bold', 'italic'] },
      { text: 'c', marks: [] },
    ]);
  });

  it('splits newlines out of marked spans', () => {
    expect(normalizeManuscriptSpans([{ text: '\na\n', marks: ['bold'] }])).toEqual([
      { text: '\n', marks: [] },
      { text: 'a', marks: ['bold'] },
      { text: '\n', marks: [] },
    ]);
  });

  it('keeps adjacent spans with different marks apart', () => {
    expect(
      normalizeManuscriptSpans([
        { text: 'a', marks: ['bold', 'italic'] },
        { text: 'b', marks: ['bold'] },
        { text: 'c', marks: ['italic'] },
      ]),
    ).toEqual([
      { text: 'a', marks: ['bold', 'italic'] },
      { text: 'b', marks: ['bold'] },
      { text: 'c', marks: ['italic'] },
    ]);
  });
});

describe('normalizeManuscriptDocument', () => {
  it('keeps textless blocks as canonical empty blocks', () => {
    expect(
      normalizeManuscriptDocument({
        blocks: [
          { kind: 'paragraph', spans: [{ text: '', marks: [] }] },
          paragraph('T'),
          { kind: 'paragraph', spans: [{ text: ' \n ', marks: ['bold'] }] },
        ],
      }),
    ).toEqual({
      blocks: [{ kind: 'paragraph', spans: [] }, paragraph('T'), { kind: 'paragraph', spans: [] }],
    });
  });
});

describe('isEmptyManuscriptDocument', () => {
  it('classifies empty and non-empty documents', () => {
    expect(isEmptyManuscriptDocument({ blocks: [] })).toBe(true);
    expect(
      isEmptyManuscriptDocument({
        blocks: [{ kind: 'paragraph', spans: [{ text: '', marks: [] }] }],
      }),
    ).toBe(true);
    expect(
      isEmptyManuscriptDocument({
        blocks: [{ kind: 'paragraph', spans: [] }, paragraph('x')],
      }),
    ).toBe(false);
    expect(isEmptyManuscriptDocument({ blocks: [paragraph('x')] })).toBe(false);
  });
});

describe('parseMarkdownToDocument', () => {
  it('returns no blocks for empty or blank input', () => {
    expect(parseMarkdownToDocument('')).toEqual({ blocks: [] });
    expect(parseMarkdownToDocument('  \n  \n ')).toEqual({ blocks: [] });
  });

  it('splits blank-line separated paragraphs, keeping runs as empty blocks', () => {
    const doc = parseMarkdownToDocument('First.\n\n\n\nSecond.');

    expect(doc.blocks).toEqual([
      paragraph('First.'),
      { kind: 'paragraph', spans: [] },
      paragraph('Second.'),
    ]);
  });

  it('preserves longer runs and edge blank lines', () => {
    expect(parseMarkdownToDocument('a\n\n\n\n\n\nb').blocks).toEqual([
      paragraph('a'),
      { kind: 'paragraph', spans: [] },
      { kind: 'paragraph', spans: [] },
      paragraph('b'),
    ]);
    expect(parseMarkdownToDocument('\n\na\n\n').blocks).toEqual([
      { kind: 'paragraph', spans: [] },
      paragraph('a'),
      { kind: 'paragraph', spans: [] },
    ]);
  });

  it('degrades odd non-canonical runs without blank-line leftovers', () => {
    expect(parseMarkdownToDocument('a\n\n\nb').blocks).toEqual([paragraph('a'), paragraph('b')]);
    expect(parseMarkdownToDocument('a\n   \n b').blocks).toEqual([paragraph('a'), paragraph('b')]);
  });

  it('normalizes CRLF and lone CR line endings before splitting', () => {
    const doc = parseMarkdownToDocument('# Title\r\n\r\nFirst.\rSecond.\r\n\r\n**bold** tail');

    expect(doc.blocks).toHaveLength(3);
    expect(doc.blocks[0]).toEqual(paragraph('Title'));
    expect(doc.blocks[1]).toEqual(paragraph('First.\nSecond.'));
    expect(documentTextContent(doc)).not.toContain('\r');
  });

  it('degrades legacy heading prefixes to plain paragraphs, keeps bare hashes literal', () => {
    const doc = parseMarkdownToDocument('# One\n\n## Two\n\n### Three');

    expect(doc.blocks).toEqual([paragraph('One'), paragraph('Two'), paragraph('Three')]);
    expect(parseMarkdownToDocument('#Nope and C#').blocks).toEqual([paragraph('#Nope and C#')]);
  });

  it('parses the four inline marks', () => {
    expect(parseMarkdownToDocument('A **bold**, *soft*, __lined__ and ~~cut~~.').blocks).toEqual([
      {
        kind: 'paragraph',
        spans: [
          { text: 'A ', marks: [] },
          { text: 'bold', marks: ['bold'] },
          { text: ', ', marks: [] },
          { text: 'soft', marks: ['italic'] },
          { text: ', ', marks: [] },
          { text: 'lined', marks: ['underline'] },
          { text: ' and ', marks: [] },
          { text: 'cut', marks: ['strikethrough'] },
          { text: '.', marks: [] },
        ],
      },
    ]);
  });

  it('nests distinct markers', () => {
    expect(parseMarkdownToDocument('__**x**__').blocks).toEqual([
      paragraph('x', ['bold', 'underline']),
    ]);
    expect(parseMarkdownToDocument('***x***').blocks).toEqual([paragraph('x', ['bold', 'italic'])]);
    expect(parseMarkdownToDocument('*__x__*').blocks).toEqual([
      paragraph('x', ['italic', 'underline']),
    ]);
  });

  it('leaves unmatched and empty markers literal', () => {
    for (const source of ['**x', '*x', 'a**b', '****', '2 * 3 = 6', '**a__b']) {
      expect(parseMarkdownToDocument(source).blocks).toEqual([paragraph(source)]);
    }
  });

  it('degrades overlapping markers to literal', () => {
    expect(parseMarkdownToDocument('**a__b**c__').blocks).toEqual([paragraph('**a__b**c__')]);
  });

  it('honors backslash escapes and keeps other backslashes', () => {
    expect(parseMarkdownToDocument('\\*x\\*').blocks).toEqual([paragraph('*x*')]);
    expect(parseMarkdownToDocument('a\\\\b').blocks).toEqual([paragraph('a\\b')]);
    expect(parseMarkdownToDocument('\\x').blocks).toEqual([paragraph('\\x')]);
    expect(parseMarkdownToDocument('a\\').blocks).toEqual([paragraph('a\\')]);
  });

  it('preserves single newlines but never styles across them', () => {
    expect(parseMarkdownToDocument('"Yes,"\n"No."').blocks).toEqual([paragraph('"Yes,"\n"No."')]);
    expect(parseMarkdownToDocument('**a\nb**').blocks).toEqual([paragraph('**a\nb**')]);
  });
});

describe('serializeDocumentToMarkdown', () => {
  it('serializes empty docs to empty string', () => {
    expect(serializeDocumentToMarkdown({ blocks: [] })).toBe('');
  });

  it('emits paragraphs joined by blank lines', () => {
    expect(
      serializeDocumentToMarkdown({
        blocks: [paragraph('T', ['bold']), paragraph('plain')],
      }),
    ).toBe('**T**\n\nplain');
  });

  it('emits empty blocks as blank lines', () => {
    expect(
      serializeDocumentToMarkdown({
        blocks: [paragraph('a'), { kind: 'paragraph', spans: [] }, paragraph('b')],
      }),
    ).toBe('a\n\n\n\nb');
  });

  it('nests combined marks deterministically', () => {
    expect(serializeDocumentToMarkdown({ blocks: [paragraph('x', ['italic', 'bold'])] })).toBe(
      '***x***',
    );
    expect(
      serializeDocumentToMarkdown({ blocks: [paragraph('x', ['strikethrough', 'underline'])] }),
    ).toBe('~~__x__~~');
  });

  it('escapes literal markup only when it would otherwise parse', () => {
    expect(serializeDocumentToMarkdown({ blocks: [paragraph('2 * 3')] })).toBe('2 * 3');
    expect(serializeDocumentToMarkdown({ blocks: [paragraph('a*b*c')] })).toBe('a\\*b\\*c');
    expect(serializeDocumentToMarkdown({ blocks: [paragraph('a_b')] })).toBe('a_b');
    expect(serializeDocumentToMarkdown({ blocks: [paragraph('a__b__c')] })).toBe('a\\_\\_b\\_\\_c');
    expect(serializeDocumentToMarkdown({ blocks: [paragraph('a~b')] })).toBe('a~b');
    expect(serializeDocumentToMarkdown({ blocks: [paragraph('a~~b~~c')] })).toBe('a\\~\\~b\\~\\~c');
    expect(serializeDocumentToMarkdown({ blocks: [paragraph('C:\\temp')] })).toBe('C:\\temp');
    expect(serializeDocumentToMarkdown({ blocks: [paragraph('# x')] })).toBe('\\# x');
    expect(serializeDocumentToMarkdown({ blocks: [paragraph('C#')] })).toBe('C#');
  });

  it('escapes text markers next to structural markers', () => {
    expect(
      serializeDocumentToMarkdown({
        blocks: [
          {
            kind: 'paragraph',
            spans: [
              { text: 'a*', marks: [] },
              { text: 'x', marks: ['italic'] },
            ],
          },
        ],
      }),
    ).toBe('a\\**x*');
    expect(
      serializeDocumentToMarkdown({
        blocks: [
          {
            kind: 'paragraph',
            spans: [
              { text: 'a_b', marks: [] },
              { text: 'x', marks: ['underline'] },
            ],
          },
        ],
      }),
    ).toBe('a\\_b__x__');
  });

  it('round-trips canonical markdown byte-identically', () => {
    const corpus = [
      '',
      'plain',
      'A **bold** move',
      '*it* and __ul__ and ~~s~~',
      '***both***',
      '__**nest**__',
      'a*b',
      '\\*esc\\*',
      '#Nope',
      'C#',
      '\\# head',
      'multi\nline',
      'p1\n\np2',
      'p1\n\n\n\np2',
      'p1\n\n\n\n\n\np2',
      '\n\np1\n\n',
      '---',
      '___',
      '2 * 3',
      'C:\\temp',
      'a_b_c',
      '100 ~ ok',
      '**a**b**c**',
      '**a**\n**b**',
    ];
    for (const markdown of corpus) {
      expect(serializeDocumentToMarkdown(parseMarkdownToDocument(markdown))).toBe(markdown);
    }
  });

  it('degrades legacy heading prefixes instead of round-tripping them', () => {
    const cases: [string, string][] = [
      ['# H1', 'H1'],
      ['## H2', 'H2'],
      ['### H3', 'H3'],
      ['# **Bold head**', '**Bold head**'],
    ];
    for (const [source, degraded] of cases) {
      expect(serializeDocumentToMarkdown(parseMarkdownToDocument(source))).toBe(degraded);
    }
  });

  it('round-trips documents semantically', () => {
    const docs: ManuscriptDocument[] = [
      { blocks: [paragraph('x', ['bold', 'italic', 'underline', 'strikethrough'])] },
      { blocks: [paragraph('~~__both outer~~__')] },
      {
        blocks: [
          paragraph('T *', ['bold']),
          paragraph('a\nb', ['italic']),
          paragraph('\\# literal hash, 2 * 3, C:\\temp'),
        ],
      },
    ];
    for (const doc of docs) {
      const roundTripped = parseMarkdownToDocument(serializeDocumentToMarkdown(doc));
      expect(charMarks(roundTripped)).toEqual(charMarks(normalizeManuscriptDocument(doc)));
    }
  });
});

describe('documentTextContent', () => {
  it('joins span contents with blank-line block separators', () => {
    expect(
      documentTextContent({
        blocks: [
          paragraph('Title', ['bold']),
          {
            kind: 'paragraph',
            spans: [
              { text: 'A ', marks: [] },
              { text: 'bold', marks: ['bold'] },
              { text: ' move.', marks: [] },
            ],
          },
        ],
      }),
    ).toBe('Title\n\nA bold move.');
    expect(documentTextContent({ blocks: [] })).toBe('');
  });

  it('counts blank lines through the block separators', () => {
    expect(
      documentTextContent({
        blocks: [paragraph('a'), { kind: 'paragraph', spans: [] }, paragraph('b')],
      }),
    ).toBe('a\n\n\n\nb');
  });
});
