import {
  formatStatValue,
  formatTierLabel,
  generateNumericLadder,
  normalizeValue,
  OVERSHOOT_RATIO,
  resolveLadder,
  sortLadder,
  tierOf,
  type StatTier,
} from '@keres/shared/graphs/statLadder';

/** A escada do enunciado: F em 0, C em 50, A em 400. */
const LETTER_LADDER: StatTier[] = [
  { id: 'f', label: 'F', minValue: 0 },
  { id: 'c', label: 'C', minValue: 50 },
  { id: 'a', label: 'A', minValue: 400 },
];

describe('sortLadder', () => {
  it('orders tiers by their floor', () => {
    const sorted = sortLadder([
      { label: 'A', minValue: 400 },
      { label: 'F', minValue: 0 },
      { label: 'C', minValue: 50 },
    ]);

    expect(sorted.map((tier) => tier.label)).toEqual(['F', 'C', 'A']);
  });

  it('opens the ladder at zero when the lowest tier starts above it', () => {
    const sorted = sortLadder([{ label: 'C', minValue: 50 }]);

    expect(sorted[0]).toEqual({ label: '—', minValue: 0 });
    expect(sorted).toHaveLength(2);
  });

  it('keeps a ladder that already starts at zero untouched', () => {
    expect(sortLadder(LETTER_LADDER)).toHaveLength(3);
  });

  it('opens an empty ladder at zero too', () => {
    expect(sortLadder([])).toEqual([{ label: '—', minValue: 0 }]);
  });
});

describe('resolveLadder', () => {
  const strengths = [
    { id: '1', statId: null, label: 'F', minValue: 0 },
    { id: '2', statId: null, label: 'S', minValue: 100 },
    { id: '3', statId: 'strength', label: 'weak', minValue: 0 },
    { id: '4', statId: 'strength', label: 'strong', minValue: 900 },
  ];

  it('uses the stat own ladder when it has one', () => {
    expect(resolveLadder('strength', strengths).map((tier) => tier.label)).toEqual([
      'weak',
      'strong',
    ]);
  });

  it('falls back to the story default ladder', () => {
    expect(resolveLadder('cunning', strengths).map((tier) => tier.label)).toEqual(['F', 'S']);
  });

  it('still opens at zero when neither ladder exists', () => {
    expect(resolveLadder('cunning', [])).toEqual([{ label: '—', minValue: 0 }]);
  });
});

describe('tierOf', () => {
  it('places a value on the floor of its own tier', () => {
    expect(tierOf(50, LETTER_LADDER)).toMatchObject({ index: 1, label: 'C', fraction: 0 });
  });

  it('places a value below the second floor in the first tier', () => {
    expect(tierOf(49, LETTER_LADDER)).toMatchObject({ index: 0, label: 'F' });
  });

  it('measures how far into the tier the value sits', () => {
    // 100 is in C, a third of the way to A: (100-50)/(400-50).
    const position = tierOf(100, LETTER_LADDER);

    expect(position?.label).toBe('C');
    expect(position?.fraction).toBeCloseTo(1 / 7, 5);
  });

  it('marks a value above the last floor as overflow', () => {
    expect(tierOf(500, LETTER_LADDER)).toMatchObject({ index: 2, label: 'A', isOverflow: true });
  });

  it('measures overflow in widths of the last closed interval', () => {
    // The last interval is 350 wide; 175 above the top is half a width.
    expect(tierOf(575, LETTER_LADDER)?.fraction).toBeCloseTo(0.5, 5);
  });

  it('never returns a position for an empty ladder', () => {
    expect(tierOf(10, [])).toBeNull();
  });
});

describe('normalizeValue', () => {
  it('puts the bottom of the ladder at the centre', () => {
    expect(normalizeValue(0, LETTER_LADDER)).toBe(0);
  });

  it('puts the top of the ladder on the outer ring', () => {
    expect(normalizeValue(400, LETTER_LADDER)).toBe(1);
  });

  it('puts a middle floor on its own ring', () => {
    // Two intervals: C's ring is the first of two, that is, half the radius.
    expect(normalizeValue(50, LETTER_LADDER)).toBeCloseTo(0.5, 5);
  });

  it('renders the example from the spec one third of the way between the rings', () => {
    // 100 is 1/7 of the way into C, and C occupies the outer half of the radius.
    expect(normalizeValue(100, LETTER_LADDER)).toBeCloseTo(0.5 + 1 / 7 / 2, 5);
  });

  it('walks into the overflow band proportionally', () => {
    expect(normalizeValue(575, LETTER_LADDER)).toBeCloseTo(1 + OVERSHOOT_RATIO * 0.5, 5);
  });

  it('stops at the edge of the overflow band', () => {
    expect(normalizeValue(100000, LETTER_LADDER)).toBeCloseTo(1 + OVERSHOOT_RATIO, 5);
  });

  it('keeps a value below the ladder at the centre', () => {
    expect(normalizeValue(-10, LETTER_LADDER)).toBe(0);
  });

  it('handles a ladder with a single tier without dividing by zero', () => {
    const single: StatTier[] = [{ label: 'only', minValue: 0 }];

    expect(normalizeValue(0, single)).toBe(0);
    expect(normalizeValue(7, single)).toBe(1);
  });
});

describe('formatStatValue', () => {
  it('shows the tier label in letter notation', () => {
    expect(formatStatValue(100, LETTER_LADDER, 'letter')).toBe('C');
  });

  it('shows the number itself in number notation', () => {
    expect(formatStatValue(100, LETTER_LADDER, 'number')).toBe('100');
  });

  it('trims trailing zeros from a fractional value', () => {
    expect(formatStatValue(7.5, LETTER_LADDER, 'number')).toBe('7.5');
  });

  it('shows a dash when there is no value', () => {
    expect(formatStatValue(null, LETTER_LADDER, 'letter')).toBe('—');
  });
});

describe('formatTierLabel', () => {
  it('names the tier a value fell into', () => {
    expect(formatTierLabel(100, LETTER_LADDER)).toBe('C');
  });

  it('names the tier at its own floor', () => {
    expect(formatTierLabel(400, LETTER_LADDER)).toBe('A');
  });

  it('marks a value past the top tier', () => {
    expect(formatTierLabel(900, LETTER_LADDER)).toBe('A+');
  });

  it('shows a dash when there is no value', () => {
    expect(formatTierLabel(null, LETTER_LADDER)).toBe('—');
  });

  it('shows a dash when the stat has no ladder at all', () => {
    expect(formatTierLabel(100, [])).toBe('—');
  });
});

describe('generateNumericLadder', () => {
  it('builds every step from the base to the top, inclusive', () => {
    const ladder = generateNumericLadder(0, 100, 10);

    expect(ladder).toHaveLength(11);
    expect(ladder[0]).toMatchObject({ label: '0', minValue: 0 });
    expect(ladder[10]).toMatchObject({ label: '100', minValue: 100 });
  });

  it('opens at zero even when the range starts higher', () => {
    const ladder = generateNumericLadder(10, 30, 10);

    expect(ladder[0]!.minValue).toBe(0);
    expect(ladder.map((tier) => tier.minValue)).toEqual([0, 10, 20, 30]);
  });

  it('survives a fractional step without floating point drift', () => {
    const ladder = generateNumericLadder(0, 1, 0.1);

    expect(ladder).toHaveLength(11);
    expect(ladder[3]!.minValue).toBe(0.3);
  });

  it('refuses a step that would never reach the top', () => {
    expect(() => generateNumericLadder(0, 100, 0)).toThrow(/greater than zero/);
    expect(() => generateNumericLadder(0, 100, -5)).toThrow(/greater than zero/);
  });

  it('refuses an inverted or negative range', () => {
    expect(() => generateNumericLadder(100, 10, 5)).toThrow(/above its base/);
    expect(() => generateNumericLadder(-10, 10, 5)).toThrow(/below zero/);
  });
});
