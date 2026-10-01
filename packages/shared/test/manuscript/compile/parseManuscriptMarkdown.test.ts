import { describe, expect, it } from 'vitest';
import {
  countManuscriptDisplayChars,
  getManuscriptSizeStatus,
  parseManuscriptMarkdown,
  stripManuscriptMarkers,
} from '../../../manuscript/compile/parseManuscriptMarkdown';
import {
  parseMarkdownToDocument,
  type ManuscriptSpan,
} from '../../../manuscript/ManuscriptDocument';

describe('parseManuscriptMarkdown', () => {
  it('returns no blocks for empty or blank input', () => {
    expect(parseManuscriptMarkdown('')).toEqual([]);
    expect(parseManuscriptMarkdown('  \n  \n ')).toEqual([]);
  });

  it('splits blank-line separated paragraphs', () => {
    const blocks = parseManuscriptMarkdown('First.\n\nSecond.');

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'paragraph', inlines: [{ text: 'First.' }] });
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', inlines: [{ text: 'Second.' }] });
  });

  it('degrades legacy heading prefixes to plain paragraphs', () => {
    const blocks = parseManuscriptMarkdown('# One\n\n## Two\n\n### Three');

    expect(blocks).toMatchObject([
      { kind: 'paragraph' },
      { kind: 'paragraph' },
      { kind: 'paragraph' },
    ]);
    expect(blocks[0].inlines).toEqual([{ text: 'One' }]);
  });

  it('keeps hashes without a space as plain text', () => {
    const blocks = parseManuscriptMarkdown('#Nope');

    expect(blocks).toMatchObject([{ kind: 'paragraph' }]);
    expect(blocks[0].inlines).toEqual([{ text: '#Nope' }]);
  });

  it('parses bold and italic spans', () => {
    const blocks = parseManuscriptMarkdown('A **bold** move and an *aside*.');

    expect(blocks).toHaveLength(1);
    expect(blocks[0].inlines).toEqual([
      { text: 'A ' },
      { text: 'bold', bold: true },
      { text: ' move and an ' },
      { text: 'aside', italic: true },
      { text: '.' },
    ]);
  });

  it('parses underline spans', () => {
    const blocks = parseManuscriptMarkdown('Read __this part__ carefully.');

    expect(blocks[0].inlines).toEqual([
      { text: 'Read ' },
      { text: 'this part', underline: true },
      { text: ' carefully.' },
    ]);
  });

  it('leaves unmatched markers literal', () => {
    const blocks = parseManuscriptMarkdown('A **lonely marker here.\n\nAnd *one more.');

    expect(blocks).toHaveLength(2);
    expect(blocks[0].inlines).toEqual([{ text: 'A **lonely marker here.' }]);
    expect(blocks[1].inlines).toEqual([{ text: 'And *one more.' }]);
  });

  it('preserves single newlines inside a block', () => {
    const blocks = parseManuscriptMarkdown('"Yes," she said.\n"No," he replied.');

    expect(blocks).toHaveLength(1);
    expect(blocks[0].inlines).toEqual([{ text: '"Yes," she said.\n"No," he replied.' }]);
  });

  it('parses inline styles in degraded legacy headings', () => {
    const blocks = parseManuscriptMarkdown('## The **bold** chapter');

    expect(blocks[0]).toMatchObject({ kind: 'paragraph' });
    expect(blocks[0].inlines).toEqual([
      { text: 'The ' },
      { text: 'bold', bold: true },
      { text: ' chapter' },
    ]);
  });

  it('keys blocks in order', () => {
    const blocks = parseManuscriptMarkdown('A\n\nB\n\nC');

    expect(blocks.map((block) => block.key)).toEqual(['block-0', 'block-1', 'block-2']);
  });
});

describe('parseManuscriptMarkdown strikethrough', () => {
  it('parses paired tildes as strikethrough', () => {
    const [block] = parseManuscriptMarkdown('Keep ~~this~~ out');

    expect(block.inlines).toEqual([
      { text: 'Keep ' },
      { text: 'this', strikethrough: true },
      { text: ' out' },
    ]);
  });

  it('nests distinct markers like the reader instead of swallowing them', () => {
    const [block] = parseManuscriptMarkdown('~~a __b__ c~~');

    expect(block.inlines).toEqual([
      { text: 'a ', strikethrough: true },
      { text: 'b', strikethrough: true, underline: true },
      { text: ' c', strikethrough: true },
    ]);
  });

  it('matches the reader on unclosed markers', () => {
    const [block] = parseManuscriptMarkdown('**unclosed and *single');

    expect(block.inlines).toEqual([{ text: '**unclosed and *single' }]);
  });

  it('leaves unmatched tildes literal', () => {
    const source = 'A ~~lonely marker.';
    const [block] = parseManuscriptMarkdown(source);

    expect(block.inlines).toEqual([{ text: source }]);
  });
});

describe('parseManuscriptMarkdown escapes', () => {
  it('renders backslash escapes as their literal char', () => {
    expect(parseManuscriptMarkdown('\\*x\\*')[0].inlines).toEqual([{ text: '*x*' }]);
    expect(parseManuscriptMarkdown('a\\\\b')[0].inlines).toEqual([{ text: 'a\\b' }]);
    expect(parseManuscriptMarkdown('\\# head')[0]).toMatchObject({ kind: 'paragraph' });
    expect(parseManuscriptMarkdown('\\# head')[0].inlines).toEqual([{ text: '# head' }]);
    expect(parseManuscriptMarkdown('\\x')[0].inlines).toEqual([{ text: '\\x' }]);
  });

  it('honors escapes inside styled spans', () => {
    expect(parseManuscriptMarkdown('**a\\*b**')[0].inlines).toEqual([{ text: 'a*b', bold: true }]);
  });
});

describe('parseManuscriptMarkdown reader parity', () => {
  const comparable = (spans: ManuscriptSpan[]) =>
    spans.map((span) => ({
      text: span.text,
      ...(span.marks.includes('bold') ? { bold: true } : {}),
      ...(span.marks.includes('italic') ? { italic: true } : {}),
      ...(span.marks.includes('underline') ? { underline: true } : {}),
      ...(span.marks.includes('strikethrough') ? { strikethrough: true } : {}),
    }));

  it.each([
    'Test *of* __scene__ *"like this"* ~~that will be a failure~~',
    'Test *of __scene__ "like this"* ~~that will be a failure~~',
    '*a **b** c*',
    '***bolditalic*** and **__both__**',
    '**unclosed and *single',
    '~~strike *nested italic* done~~',
    'escaped \\*star\\* literal',
    'a*b and 5 * 3 = 15',
    'snake__case__var',
    '"Yes," she said.\n"No," he replied.',
  ])('matches the reader on %p', (input) => {
    const [readerBlock] = parseMarkdownToDocument(input).blocks;
    const [block] = parseManuscriptMarkdown(input);

    expect(block.inlines).toEqual(comparable(readerBlock.spans));
  });
});

describe('stripManuscriptMarkers', () => {
  it('removes paired inline markers but keeps their content', () => {
    expect(stripManuscriptMarkers('A **bold**, *soft* and __lined__ line.')).toBe(
      'A bold, soft and lined line.',
    );
    expect(stripManuscriptMarkers('~~gone~~ but here')).toBe('gone but here');
  });

  it('strips bold before italic so pairs are not half-eaten', () => {
    expect(stripManuscriptMarkers('**bold**')).toBe('bold');
  });

  it('removes heading prefixes but keeps bare hashes', () => {
    expect(stripManuscriptMarkers('# One\n\n## Two')).toBe('One\n\nTwo');
    expect(stripManuscriptMarkers('#Nope and C#')).toBe('#Nope and C#');
  });

  it('removes whole-line separators but keeps dialogue dashes', () => {
    expect(stripManuscriptMarkers('Before\n\n---\n\nAfter')).toBe('Before\n\n\n\nAfter');
    expect(stripManuscriptMarkers('***')).toBe('');
    expect(stripManuscriptMarkers('- Not a separator, dialogue')).toBe(
      '- Not a separator, dialogue',
    );
  });

  it('keeps unmatched markers literal, like the renderer', () => {
    expect(stripManuscriptMarkers('A **lonely marker.\n\nAnd *one more.')).toBe(
      'A **lonely marker.\n\nAnd *one more.',
    );
    expect(stripManuscriptMarkers('2 * 3 = 6')).toBe('2 * 3 = 6');
    expect(stripManuscriptMarkers('# ---')).toBe('---');
  });

  it('keeps newlines: they are prose structure, not markup', () => {
    expect(stripManuscriptMarkers('"Yes,"\n"No."')).toBe('"Yes,"\n"No."');
  });

  it('counts escaped literals as their char', () => {
    expect(stripManuscriptMarkers('\\*x\\*')).toBe('*x*');
    expect(stripManuscriptMarkers('**a\\*b**')).toBe('a*b');
    expect(stripManuscriptMarkers('\\# head')).toBe('# head');
    expect(stripManuscriptMarkers('a\\\\b')).toBe('a\\b');
  });
});

describe('getManuscriptSizeStatus', () => {
  it.each([
    [0, 'ok'],
    [19999, 'ok'],
    [20000, 'large'],
    [30000, 'large'],
  ] as const)('maps %i storage chars to %s', (chars, expected) => {
    expect(getManuscriptSizeStatus(chars)).toBe(expected);
  });
});

describe('countManuscriptDisplayChars', () => {
  it.each([
    ['', 0],
    ['hello', 5],
    ['hello world', 11],
    ['Title\nA bold move.', 18],
    ['Title\n\nA bold move.', 18],
    ['a\n\n\n\nb', 4],
  ])('counts %p as %i', (text, expected) => {
    expect(countManuscriptDisplayChars(text)).toBe(expected);
  });
});
