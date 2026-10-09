import { plotMatches } from '../../src/utils/plotSearch';

const plot = { name: 'The Heist', details: 'A vault under the old bank' };

describe('plotMatches', () => {
  it('takes every plot when nothing narrows the list', () => {
    expect(plotMatches(plot, '', {})).toBe(true);
    expect(plotMatches(plot, '   ', {})).toBe(true);
  });

  it('looks for the typed words in the name and the details, ignoring case', () => {
    expect(plotMatches(plot, 'heist', {})).toBe(true);
    expect(plotMatches(plot, 'VAULT', {})).toBe(true);
    expect(plotMatches(plot, 'dragon', {})).toBe(false);
  });

  it('filters each field on its own', () => {
    expect(plotMatches(plot, '', { name: 'heist' })).toBe(true);
    expect(plotMatches(plot, '', { name: 'vault' })).toBe(false);
    expect(plotMatches(plot, '', { details: 'vault' })).toBe(true);
    expect(plotMatches(plot, '', { details: 'heist' })).toBe(false);
  });

  it('needs all of them at once', () => {
    expect(plotMatches(plot, 'bank', { name: 'heist', details: 'vault' })).toBe(true);
    expect(plotMatches(plot, 'bank', { name: 'heist', details: 'zzz' })).toBe(false);
    expect(plotMatches(plot, 'zzz', { name: 'heist' })).toBe(false);
  });

  it('ignores an emptied field and treats a plot without details as empty text', () => {
    expect(plotMatches(plot, '', { name: '', details: undefined })).toBe(true);
    expect(plotMatches({ name: 'Bare' }, '', { details: 'x' })).toBe(false);
    expect(plotMatches({ name: 'Bare', details: null }, 'bare', {})).toBe(true);
  });
});
