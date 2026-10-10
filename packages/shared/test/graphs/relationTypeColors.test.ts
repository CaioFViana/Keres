import { describe, expect, it } from 'vitest';
import {
  assignRelationTypeColors,
  foldRelationType,
  RELATION_TYPE_PALETTE,
} from '../../graphs/relationTypeColors';

describe('foldRelationType', () => {
  it('makes the same kind written differently one kind', () => {
    expect(foldRelationType('  Irmão  de   sangue ')).toBe('irmao de sangue');
    expect(foldRelationType('FRIEND')).toBe('friend');
  });
});

describe('assignRelationTypeColors', () => {
  it('gives every kind a colour of the palette', () => {
    const colors = assignRelationTypeColors(['friend', 'rival', 'mentor'], 'light');

    expect(colors.size).toBe(3);
    for (const color of colors.values()) {
      expect(RELATION_TYPE_PALETTE.light).toContain(color);
    }
  });

  it('gives the kinds that are on screen different colours while the palette lasts', () => {
    const kinds = ['friend', 'rival', 'mentor', 'lover', 'ally', 'enemy', 'cousin', 'boss'];

    const colors = assignRelationTypeColors(kinds, 'light');

    expect(new Set(colors.values()).size).toBe(kinds.length);
  });

  it('treats the same kind written differently as one', () => {
    const colors = assignRelationTypeColors(['Friend', 'friend', ' FRIEND '], 'light');

    expect(colors.size).toBe(1);
    expect(colors.has('friend')).toBe(true);
  });

  it('gives a kind the same colour whatever order the kinds come in', () => {
    const forward = assignRelationTypeColors(['friend', 'rival', 'mentor'], 'light');
    const backward = assignRelationTypeColors(['mentor', 'rival', 'friend'], 'light');

    expect([...forward.entries()].sort()).toEqual([...backward.entries()].sort());
  });

  it('keeps the colour of a kind that has no rival for its slot', () => {
    const alone = assignRelationTypeColors(['friend'], 'light');
    const preferred = alone.get('friend');

    // 'zzz-unused-kind' sorts after 'friend', so it never moves it.
    const withOther = assignRelationTypeColors(['friend', 'zzz-unused-kind'], 'light');

    expect(withOther.get('friend')).toBe(preferred);
  });

  it('reuses the palette from the start when there are more kinds than colours', () => {
    const many = Array.from(
      { length: RELATION_TYPE_PALETTE.light.length + 3 },
      (_, i) => `kind ${i}`,
    );

    const colors = assignRelationTypeColors(many, 'light');

    expect(colors.size).toBe(many.length);
    for (const color of colors.values()) expect(RELATION_TYPE_PALETTE.light).toContain(color);
  });

  it('uses the dark palette on a dark theme', () => {
    const colors = assignRelationTypeColors(['friend'], 'dark');

    expect(RELATION_TYPE_PALETTE.dark).toContain(colors.get('friend'));
  });

  it('ignores blank kinds and returns nothing for no kinds', () => {
    expect(assignRelationTypeColors(['  ', ''], 'light').size).toBe(0);
    expect(assignRelationTypeColors([], 'light').size).toBe(0);
  });

  it('has as many colours in the dark palette as in the light one', () => {
    expect(RELATION_TYPE_PALETTE.dark.length).toBe(RELATION_TYPE_PALETTE.light.length);
  });
});
