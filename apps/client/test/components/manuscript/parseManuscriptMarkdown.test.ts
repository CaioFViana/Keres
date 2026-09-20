import { parseManuscriptMarkdown } from '../../../src/components/features/manuscript/parseManuscriptMarkdown';

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

  it('parses heading levels', () => {
    const blocks = parseManuscriptMarkdown('# One\n\n## Two\n\n### Three');

    expect(blocks).toMatchObject([
      { kind: 'heading', level: 1 },
      { kind: 'heading', level: 2 },
      { kind: 'heading', level: 3 },
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

  it('parses inline styles inside headings', () => {
    const blocks = parseManuscriptMarkdown('## The **bold** chapter');

    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 2 });
    expect(blocks[0].inlines).toEqual([{ text: 'The ' }, { text: 'bold', bold: true }, { text: ' chapter' }]);
  });

  it('keys blocks in order', () => {
    const blocks = parseManuscriptMarkdown('A\n\nB\n\nC');

    expect(blocks.map((block) => block.key)).toEqual(['block-0', 'block-1', 'block-2']);
  });
});
