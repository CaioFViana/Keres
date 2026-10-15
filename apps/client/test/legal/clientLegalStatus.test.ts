/** @jest-environment node */
import { CLIENT_TERMS_VERSION } from '@/src/legal/clientTerms';
import { legalIsBehind } from '@/src/legal/clientLegalStatus';
import { CLIENT_PRIVACY_VERSION } from '@/src/legal/privacyPolicy';

describe('legalIsBehind', () => {
  it('is behind for a document never accepted', () => {
    expect(legalIsBehind(null, null)).toEqual({ terms: true, privacy: true });
  });

  it('is behind for a document accepted in an older version, and only that one', () => {
    expect(legalIsBehind(CLIENT_TERMS_VERSION - 1, CLIENT_PRIVACY_VERSION)).toEqual({
      terms: true,
      privacy: false,
    });
    expect(legalIsBehind(CLIENT_TERMS_VERSION, CLIENT_PRIVACY_VERSION - 1)).toEqual({
      terms: false,
      privacy: true,
    });
  });

  it('is not behind for the current version', () => {
    expect(legalIsBehind(CLIENT_TERMS_VERSION, CLIENT_PRIVACY_VERSION)).toEqual({
      terms: false,
      privacy: false,
    });
  });

  it('is not behind for a higher stored version', () => {
    expect(legalIsBehind(CLIENT_TERMS_VERSION + 1, CLIENT_PRIVACY_VERSION + 1)).toEqual({
      terms: false,
      privacy: false,
    });
  });

  it('tracks each document on its own when one is never accepted', () => {
    expect(legalIsBehind(null, CLIENT_PRIVACY_VERSION)).toEqual({ terms: true, privacy: false });
    expect(legalIsBehind(CLIENT_TERMS_VERSION, null)).toEqual({ terms: false, privacy: true });
  });
});
