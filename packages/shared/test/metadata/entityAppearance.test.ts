import { describe, expect, it } from 'vitest';
import { ENTITY_APPEARANCE, getEntityAppearance } from '../../metadata/entityAppearance';

describe('entityAppearance', () => {
  it('gives every declared type a hex colour and an icon name', () => {
    for (const [type, appearance] of Object.entries(ENTITY_APPEARANCE)) {
      expect(appearance.color, type).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(appearance.icon, type).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('returns the table row for a known type, so a palette change updates every caller', () => {
    expect(getEntityAppearance('Character')).toBe(ENTITY_APPEARANCE.Character);
  });

  it('falls back for an unknown type instead of throwing', () => {
    expect(getEntityAppearance('NotAType').icon).toBe('ellipse');
    expect(getEntityAppearance('NotAType')).not.toBe(ENTITY_APPEARANCE.Character);
  });
});
