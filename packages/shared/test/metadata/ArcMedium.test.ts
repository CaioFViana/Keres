import { describe, expect, it } from 'vitest';
import {
  ARC_MEDIUM_TERMS,
  ARC_MEDIUMS,
  arcMediumTerms,
  DEFAULT_ARC_MEDIUM,
  isArcMedium,
} from '../../metadata/ArcMedium';

describe('ArcMedium', () => {
  it('defaults to generic and recognises only its own values', () => {
    expect(DEFAULT_ARC_MEDIUM).toBe('generic');
    expect(isArcMedium('comic')).toBe(true);
    expect(isArcMedium('podcast')).toBe(false);
    expect(isArcMedium(undefined)).toBe(false);
  });

  it('brings no terms for generic, so prose reads as it always has', () => {
    expect(arcMediumTerms('generic', 'en')).toEqual({});
    expect(arcMediumTerms('generic', 'pt')).toEqual({});
  });

  it('has every medium in both languages, with complete terms', () => {
    for (const medium of ARC_MEDIUMS) {
      for (const language of ['en', 'pt'] as const) {
        const table = ARC_MEDIUM_TERMS[medium][language];
        for (const term of Object.values(table)) {
          expect(term.singular.length).toBeGreaterThan(0);
          expect(term.plural.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps the non-generic mediums in step across languages', () => {
    for (const medium of ARC_MEDIUMS) {
      expect(Object.keys(ARC_MEDIUM_TERMS[medium].pt).sort()).toEqual(
        Object.keys(ARC_MEDIUM_TERMS[medium].en).sort(),
      );
    }
  });
});
