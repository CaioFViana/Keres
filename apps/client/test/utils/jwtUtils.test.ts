import { afterEach, beforeEach, jest } from '@jest/globals';
import { decodeJwt, isJwtExpired } from '../../src/utils/jwtUtils';

const tokenWithPayload = (payload: object) => `header.${btoa(JSON.stringify(payload))}.signature`;
let warnSpy: jest.Spied<typeof console.warn>;

beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => warnSpy.mockRestore());

describe('JWT utilities', () => {
  it('decodes valid payloads and rejects malformed tokens', () => {
    expect(decodeJwt(tokenWithPayload({ exp: 123, userId: 'user-1' }))).toMatchObject({
      exp: 123,
      userId: 'user-1',
    });
    expect(decodeJwt('not-a-token')).toBeNull();
  });

  it('applies the expiration grace period', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isJwtExpired(tokenWithPayload({ exp: now + 30 }), 60)).toBe(true);
    expect(isJwtExpired(tokenWithPayload({ exp: now + 120 }), 60)).toBe(false);
    expect(isJwtExpired('invalid')).toBe(false);
  });
});
