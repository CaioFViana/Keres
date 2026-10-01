import { normalizeLocalUsername } from '../../src/utils/localUsername';

describe('normalizeLocalUsername', () => {
  it('keeps a name as typed, without the spaces around it', () => {
    expect(normalizeLocalUsername('Ana')).toBe('Ana');
    expect(normalizeLocalUsername('  Ana Maria \n')).toBe('Ana Maria');
  });

  it('accepts one character and does not cap the length: nothing bounds a display name', () => {
    expect(normalizeLocalUsername('A')).toBe('A');
    expect(normalizeLocalUsername('x'.repeat(500))).toHaveLength(500);
  });

  it('refuses what is left of nothing', () => {
    expect(normalizeLocalUsername('')).toBeNull();
    expect(normalizeLocalUsername('   \t ')).toBeNull();
  });
});
