import { truncate } from '../../src/utils/stringUtils';

describe('truncate', () => {
  it('returns the text untouched when it fits', () => {
    expect(truncate('Keres', 10)).toBe('Keres');
  });

  it('keeps text of exactly the maximum length', () => {
    expect(truncate('Keres', 5)).toBe('Keres');
  });

  it('cuts at the limit and appends an ellipsis', () => {
    expect(truncate('Keres, a deusa', 5)).toBe('Keres...');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ])('returns an empty string for %s', (_label, value) => {
    expect(truncate(value, 10)).toBe('');
  });

  it('degrades to just the ellipsis at a zero limit', () => {
    expect(truncate('Keres', 0)).toBe('...');
  });
});
