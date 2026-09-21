import {
  getManuscriptSizeStatus,
  parseManuscriptMarkdown,
  stripManuscriptMarkers,
} from '../../../src/components/features/manuscript/parseManuscriptMarkdown';

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
    expect(blocks[0].inlines).toEqual([{ text: 'The ' }, { text: 'bold', bold: true }, { text: ' chapter' }]);
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

  it('applies strikethrough as the outermost level, before underline', () => {
    const [block] = parseManuscriptMarkdown('~~a __b__ c~~');

    expect(block.inlines).toEqual([{ text: 'a __b__ c', strikethrough: true }]);
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
    expect(parseManuscriptMarkdown('**a\\*b**')[0].inlines).toEqual([
      { text: 'a*b', bold: true },
    ]);
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
    [20000, 'ok'],
    [20001, 'large'],
    [26999, 'large'],
    [27000, 'tooLarge'],
    [30000, 'tooLarge'],
  ] as const)('maps %i visible chars to %s', (chars, expected) => {
    expect(getManuscriptSizeStatus(chars)).toBe(expected);
  });
});
