import { describe, expect, it } from 'vitest';
import {
  AVATAR_FALLBACK_PALETTE,
  AVATAR_ICON_OPTIONS,
  avatarColorFromSeed,
  DEFAULT_AVATAR_ICON,
} from '../../metadata/avatar';

describe('avatar icon options', () => {
  it('offers a small hand-picked set, with no repeats', () => {
    expect(AVATAR_ICON_OPTIONS.length).toBeGreaterThan(10);
    expect(new Set(AVATAR_ICON_OPTIONS).size).toBe(AVATAR_ICON_OPTIONS.length);
  });

  it('includes the icon used for a profile that never picked one', () => {
    expect(AVATAR_ICON_OPTIONS).toContain(DEFAULT_AVATAR_ICON);
  });

  // The names become both a font glyph (the app) and an .svg file name (the site).
  it('uses names that are safe as file names', () => {
    for (const icon of AVATAR_ICON_OPTIONS) {
      expect(icon).toMatch(/^[a-z][a-z-]*[a-z]$/);
    }
  });
});

describe('avatarColorFromSeed', () => {
  it('always answers with a color from the palette', () => {
    for (const seed of ['ana', 'bia', 'carlos', '01ARZ3NDEKTSV4RRFFQ69G5FAV', '']) {
      expect(AVATAR_FALLBACK_PALETTE).toContain(avatarColorFromSeed(seed));
    }
  });

  // The same user has to get the same colour in the app and on the site, with nothing stored in the database.
  it('gives the same seed the same color every time', () => {
    expect(avatarColorFromSeed('ana')).toBe(avatarColorFromSeed('ana'));
    expect(avatarColorFromSeed('ana')).not.toBe(avatarColorFromSeed('ana '));
  });

  it('spreads different seeds across the palette', () => {
    const seeds = Array.from({ length: 60 }, (_, index) => `user-${index}`);
    const used = new Set(seeds.map(avatarColorFromSeed));
    expect(used.size).toBeGreaterThan(1);
  });
});
