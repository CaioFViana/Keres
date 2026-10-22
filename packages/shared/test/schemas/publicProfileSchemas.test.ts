import { describe, expect, it } from 'vitest';
import {
  isProfileThemeKey,
  isPublicWebUrl,
  PROFILE_BIOGRAPHY_MAX_LENGTH,
  PROFILE_LINKS_MAX,
  ProfileLinkSchema,
  UpdateOwnPublicProfileSchema,
} from '../../index';

describe('isPublicWebUrl', () => {
  it.each([
    'https://example.com',
    'http://example.com/path?x=1#y',
    'https://sub.example.com:8080/a',
  ])('accepts %s', (url) => expect(isPublicWebUrl(url)).toBe(true));

  it.each([
    'javascript:alert(1)',
    'data:text/html,<b>x</b>',
    'ftp://example.com',
    'example.com',
    '//example.com',
    'https://user:pass@example.com',
    'https://exa mple.com',
    'https://example.com/\nx',
    '',
  ])('refuses %j', (url) => expect(isPublicWebUrl(url)).toBe(false));
});

describe('isProfileThemeKey', () => {
  it('knows the named palettes and nothing else', () => {
    expect(isProfileThemeKey('ocean')).toBe(true);
    expect(isProfileThemeKey('default')).toBe(true);
    expect(isProfileThemeKey('toString')).toBe(false);
    expect(isProfileThemeKey('nope')).toBe(false);
  });
});

describe('ProfileLinkSchema', () => {
  it('trims the label and the address', () => {
    expect(ProfileLinkSchema.parse({ label: '  My site ', url: ' https://example.com ' })).toEqual({
      label: 'My site',
      url: 'https://example.com',
    });
  });

  it('refuses an empty label and an unsafe address', () => {
    expect(ProfileLinkSchema.safeParse({ label: ' ', url: 'https://example.com' }).success).toBe(
      false,
    );
    expect(ProfileLinkSchema.safeParse({ label: 'x', url: 'javascript:alert(1)' }).success).toBe(
      false,
    );
  });
});

describe('UpdateOwnPublicProfileSchema', () => {
  it('accepts a partial payload and null to clear', () => {
    expect(UpdateOwnPublicProfileSchema.parse({})).toEqual({});
    expect(UpdateOwnPublicProfileSchema.parse({ biography: null, theme: null })).toEqual({
      biography: null,
      theme: null,
    });
  });

  it('caps the biography, the number of links and checks the theme', () => {
    expect(
      UpdateOwnPublicProfileSchema.safeParse({
        biography: 'x'.repeat(PROFILE_BIOGRAPHY_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    const link = { label: 'a', url: 'https://example.com' };
    expect(
      UpdateOwnPublicProfileSchema.safeParse({ links: Array(PROFILE_LINKS_MAX + 1).fill(link) })
        .success,
    ).toBe(false);
    expect(UpdateOwnPublicProfileSchema.safeParse({ theme: 'not-a-palette' }).success).toBe(false);
    expect(UpdateOwnPublicProfileSchema.safeParse({ theme: 'ocean' }).success).toBe(true);
  });
});
