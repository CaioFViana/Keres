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
    level: block.kind === 'heading' ? block.level : 0,
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
  it('drops textless blocks and keeps heading levels', () => {
    expect(
      normalizeManuscriptDocument({
        blocks: [
          { kind: 'paragraph', spans: [{ text: '', marks: [] }] },
          { kind: 'heading', level: 2, spans: [{ text: 'T', marks: [] }] },
        ],
      }),
    ).toEqual({
      blocks: [{ kind: 'heading', level: 2, spans: [{ text: 'T', marks: [] }] }],
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
    expect(isEmptyManuscriptDocument({ blocks: [paragraph('x')] })).toBe(false);
  });
});

describe('parseMarkdownToDocument', () => {
  it('returns no blocks for empty or blank input', () => {
    expect(parseMarkdownToDocument('')).toEqual({ blocks: [] });
    expect(parseMarkdownToDocument('  \n  \n ')).toEqual({ blocks: [] });
  });

  it('splits blank-line separated paragraphs, collapsing runs', () => {
    const doc = parseMarkdownToDocument('First.\n\n\n\nSecond.');

    expect(doc.blocks).toHaveLength(2);
    expect(doc.blocks[0]).toEqual(paragraph('First.'));
    expect(doc.blocks[1]).toEqual(paragraph('Second.'));
  });

  it('parses heading levels but keeps bare hashes literal', () => {
    const doc = parseMarkdownToDocument('# One\n\n## Two\n\n### Three');

    expect(doc.blocks.map((block) => block.kind)).toEqual(['heading', 'heading', 'heading']);
    expect(doc.blocks[0]).toMatchObject({ level: 1 });
    expect(parseMarkdownToDocument('#Nope and C#').blocks).toEqual([
      paragraph('#Nope and C#'),
    ]);
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
    expect(parseMarkdownToDocument('***x***').blocks).toEqual([
      paragraph('x', ['bold', 'italic']),
    ]);
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
    expect(parseMarkdownToDocument('**a__b**c__').blocks).toEqual([
      paragraph('**a__b**c__'),
    ]);
  });

  it('honors backslash escapes and keeps other backslashes', () => {
    expect(parseMarkdownToDocument('\\*x\\*').blocks).toEqual([paragraph('*x*')]);
    expect(parseMarkdownToDocument('a\\\\b').blocks).toEqual([paragraph('a\\b')]);
    expect(parseMarkdownToDocument('\\x').blocks).toEqual([paragraph('\\x')]);
    expect(parseMarkdownToDocument('a\\').blocks).toEqual([paragraph('a\\')]);
  });

  it('preserves single newlines but never styles across them', () => {
    expect(parseMarkdownToDocument('"Yes,"\n"No."').blocks).toEqual([
      paragraph('"Yes,"\n"No."'),
    ]);
    expect(parseMarkdownToDocument('**a\nb**').blocks).toEqual([paragraph('**a\nb**')]);
  });
});

describe('serializeDocumentToMarkdown', () => {
  it('serializes empty docs to empty string', () => {
    expect(serializeDocumentToMarkdown({ blocks: [] })).toBe('');
  });

  it('emits headings and paragraphs joined by blank lines', () => {
    expect(
      serializeDocumentToMarkdown({
        blocks: [
          { kind: 'heading', level: 1, spans: [{ text: 'T', marks: ['bold'] }] },
          paragraph('plain'),
        ],
      }),
    ).toBe('# **T**\n\nplain');
  });

  it('nests combined marks deterministically', () => {
    expect(
      serializeDocumentToMarkdown({ blocks: [paragraph('x', ['italic', 'bold'])] }),
    ).toBe('***x***');
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
      '# H1',
      '## H2',
      '### H3',
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
      '---',
      '___',
      '2 * 3',
      'C:\\temp',
      'a_b_c',
      '100 ~ ok',
      '**a**b**c**',
      '**a**\n**b**',
      '# **Bold head**',
    ];
    for (const markdown of corpus) {
      expect(serializeDocumentToMarkdown(parseMarkdownToDocument(markdown))).toBe(markdown);
    }
  });

  it('round-trips documents semantically', () => {
    const docs: ManuscriptDocument[] = [
      { blocks: [paragraph('x', ['bold', 'italic', 'underline', 'strikethrough'])] },
      { blocks: [paragraph('~~__both outer~~__')] },
      {
        blocks: [
          { kind: 'heading', level: 3, spans: [{ text: 'T *', marks: ['bold'] }] },
          paragraph('a\nb', ['italic']),
          paragraph('\\# not a heading, 2 * 3, C:\\temp'),
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
          { kind: 'heading', level: 1, spans: [{ text: 'Title', marks: ['bold'] }] },
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
});
