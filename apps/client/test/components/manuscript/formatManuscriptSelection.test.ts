import {
  applyManuscriptFormat,
  type TextSelection,
} from '../../../src/components/features/manuscript/formatManuscriptSelection';

describe('applyManuscriptFormat', () => {
  const sel = (start: number, end: number): TextSelection => ({ start, end });

  it.each([
    ['bold', 'hello world', sel(6, 11), 'hello **world**', sel(8, 13)],
    ['italic', 'hello world', sel(6, 11), 'hello *world*', sel(7, 12)],
    ['underline', 'hello world', sel(6, 11), 'hello __world__', sel(8, 13)],
  ] as const)('wraps the selection for %s', (kind, text, selection, expected, expectedSel) => {
    expect(applyManuscriptFormat(text, selection, kind)).toEqual({
      text: expected,
      selection: expectedSel,
    });
  });

  it('drops an empty marker pair around a collapsed caret', () => {
    expect(applyManuscriptFormat('hello', sel(5, 5), 'bold')).toEqual({
      text: 'hello****',
      selection: sel(7, 7),
    });
    expect(applyManuscriptFormat('', sel(0, 0), 'italic')).toEqual({
      text: '**',
      selection: sel(1, 1),
    });
  });

  it('tolerates reversed selections', () => {
    expect(applyManuscriptFormat('hello world', sel(11, 6), 'bold')).toEqual({
      text: 'hello **world**',
      selection: sel(8, 13),
    });
  });

  it('cycles the caret line through heading levels', () => {
    expect(applyManuscriptFormat('first\nsecond', sel(8, 8), 'heading')).toEqual({
      text: 'first\n# second',
      selection: sel(10, 10),
    });
    expect(applyManuscriptFormat('first\n# second', sel(10, 10), 'heading')).toEqual({
      text: 'first\n## second',
      selection: sel(11, 11),
    });
    expect(applyManuscriptFormat('first\n## second', sel(11, 11), 'heading')).toEqual({
      text: 'first\n### second',
      selection: sel(12, 12),
    });
    expect(applyManuscriptFormat('first\n### second', sel(12, 12), 'heading')).toEqual({
      text: 'first\nsecond',
      selection: sel(8, 8),
    });
  });

  it('matches the longest heading prefix first', () => {
    expect(applyManuscriptFormat('### deep', sel(8, 8), 'heading')).toEqual({
      text: 'deep',
      selection: sel(4, 4),
    });
  });

  it('only touches the caret line', () => {
    expect(applyManuscriptFormat('one\ntwo', sel(1, 1), 'heading')).toEqual({
      text: '# one\ntwo',
      selection: sel(3, 3),
    });
  });
});
