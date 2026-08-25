import { describe, expect, it } from 'vitest';
import {
  buildPublicationLabel,
  CreatePublicationRequestSchema,
  UpdateShowcaseVisibilityRequestSchema,
} from '../../schemas/PublicationSchemas';

const AUG_19 = new Date(2026, 7, 19);

describe('buildPublicationLabel', () => {
  it('builds a version-only label', () => {
    expect(buildPublicationLabel('version', 12, AUG_19, [])).toBe('v12');
  });

  it('builds a date-only label', () => {
    expect(buildPublicationLabel('date', 12, AUG_19, [])).toBe('2026-08-19');
  });

  it('builds a combined label by default', () => {
    expect(buildPublicationLabel('both', 12, AUG_19, [])).toBe('v12-2026-08-19');
  });

  it('pads month and day', () => {
    expect(buildPublicationLabel('date', 1, new Date(2026, 0, 5), [])).toBe('2026-01-05');
  });

  it('suffixes a second publication on the same day, starting at 02', () => {
    expect(buildPublicationLabel('date', 13, AUG_19, ['2026-08-19'])).toBe('2026-08-19-02');
  });

  it('keeps climbing the suffix chain', () => {
    const taken = ['2026-08-19', '2026-08-19-02', '2026-08-19-03'];
    expect(buildPublicationLabel('date', 14, AUG_19, taken)).toBe('2026-08-19-04');
  });

  it('ignores labels belonging to another day', () => {
    expect(buildPublicationLabel('date', 14, AUG_19, ['2026-08-18', '2026-08-18-02'])).toBe(
      '2026-08-19',
    );
  });

  // operationVersion is monotonic per story, so these modes should not collide - but if they do
  // (corrupted data), the function still returns something unique instead of duplicating.
  it('still resolves a collision in a version-bearing mode', () => {
    expect(buildPublicationLabel('version', 12, AUG_19, ['v12'])).toBe('v12-02');
  });
});

describe('CreatePublicationRequestSchema', () => {
  it('defaults labelMode to both', () => {
    expect(CreatePublicationRequestSchema.parse({ operationVersion: 4 }).labelMode).toBe('both');
  });

  it('rejects a negative operation version', () => {
    expect(CreatePublicationRequestSchema.safeParse({ operationVersion: -1 }).success).toBe(false);
  });
});

describe('UpdateShowcaseVisibilityRequestSchema', () => {
  it('requires a password when switching to password visibility', () => {
    expect(
      UpdateShowcaseVisibilityRequestSchema.safeParse({ visibility: 'password' }).success,
    ).toBe(false);
  });

  it('accepts password visibility with a password', () => {
    expect(
      UpdateShowcaseVisibilityRequestSchema.safeParse({
        visibility: 'password',
        password: 'hunter2',
      }).success,
    ).toBe(true);
  });

  it('accepts public visibility without a password', () => {
    expect(UpdateShowcaseVisibilityRequestSchema.safeParse({ visibility: 'public' }).success).toBe(
      true,
    );
  });
});
