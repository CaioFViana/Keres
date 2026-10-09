import {
  activeCriteria,
  countActiveCriteria,
  isActiveCriterion,
  withoutCriterion,
} from '../../src/utils/advancedSearchCriteria';

describe('isActiveCriterion', () => {
  it('counts a value that narrows the list, including a "No" answer and zero', () => {
    expect(isActiveCriterion('Lyra')).toBe(true);
    expect(isActiveCriterion(false)).toBe(true);
    expect(isActiveCriterion(true)).toBe(true);
    expect(isActiveCriterion(0)).toBe(true);
  });

  it('ignores an emptied field', () => {
    expect(isActiveCriterion('')).toBe(false);
    expect(isActiveCriterion(undefined)).toBe(false);
    expect(isActiveCriterion(null)).toBe(false);
    expect(isActiveCriterion(Number.NaN)).toBe(false);
  });
});

describe('activeCriteria', () => {
  it('keeps only the criteria that narrow the list, in order', () => {
    expect(
      activeCriteria({ name: 'Lyra', race: '', age: undefined, isFavorite: false, gender: 'F' }),
    ).toEqual({ name: 'Lyra', isFavorite: false, gender: 'F' });
  });

  it('accepts nothing at all', () => {
    expect(activeCriteria(undefined)).toEqual({});
    expect(countActiveCriteria(undefined)).toBe(0);
  });

  it('counts them', () => {
    expect(countActiveCriteria({ name: 'Lyra', race: '', 'custom:a': 3 })).toBe(2);
  });
});

describe('withoutCriterion', () => {
  it('drops one field and keeps the others', () => {
    expect(withoutCriterion({ name: 'Lyra', race: 'Elf' }, 'name')).toEqual({ race: 'Elf' });
  });

  it('also drops the emptied fields on the way', () => {
    expect(withoutCriterion({ name: 'Lyra', race: '', age: 3 }, 'name')).toEqual({ age: 3 });
  });

  it('does not touch the original', () => {
    const original = { name: 'Lyra' };
    withoutCriterion(original, 'name');
    expect(original).toEqual({ name: 'Lyra' });
  });
});
