import { describe, expect, it } from 'vitest';
import {
  assertPendingSessionMayReach,
  pendingSessionMayReach,
  VERIFICATION_PENDING_CODE,
} from '@/services/ageVerification/pendingAccess';

/**
 * The allow-list a pending session is held to (`services/ageVerification/pendingAccess.ts`): exact paths and the
 * prefixes the contract names, with the method where the contract names one.
 */
describe('what a pending session may reach', () => {
  it.each([
    ['GET', '/api/auth/verification'],
    ['POST', '/api/auth/verification/retry'],
    ['POST', '/api/auth/refresh'],
    ['POST', '/api/auth/login'],
    ['POST', '/api/auth/register'],
    ['POST', '/api/auth/forgot-password'],
    ['POST', '/api/auth/logout'],
    ['GET', '/api/auth/terms-status'],
    ['POST', '/api/auth/terms-accept'],
    ['GET', '/api/keres-tos'],
    ['GET', '/api/keres-privacy'],
    ['GET', '/api/kerescheck'],
    ['POST', '/api/age-verification/events'],
    ['GET', '/api/age-verification/info'],
    ['GET', '/api/public/stories'],
    ['GET', '/api/public'],
  ])('allows %s %s', (method, path) => {
    expect(pendingSessionMayReach(method, path)).toBe(true);
  });

  it.each([
    ['POST', '/api/auth/verification'],
    ['GET', '/api/auth/verification/retry'],
    ['GET', '/api/auth/me'],
    ['POST', '/api/auth/ws-ticket'],
    ['GET', '/api/auth/login'],
    ['GET', '/api/auth/verificationX'],
    ['GET', '/api/user/plan'],
    ['GET', '/api/user/by-tag/bia'],
    ['GET', '/api/sync/abc'],
    ['GET', '/api/stories'],
    ['POST', '/api/friend/request/abc'],
    ['GET', '/api/publicity'],
    ['GET', '/api/admin/users'],
    ['POST', '/api/ws/events'],
  ])('refuses %s %s', (method, path) => {
    expect(pendingSessionMayReach(method, path)).toBe(false);
  });

  it('refuses the pending session with the code the app acts on', () => {
    const request = new Request('http://localhost/api/user/plan', { method: 'GET' });
    try {
      assertPendingSessionMayReach(request);
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toMatchObject({
        status: 403,
        message: 'Verify your age to use this account.',
        code: VERIFICATION_PENDING_CODE,
      });
    }
  });

  it('does not gate the hosted pages, which carry no session of their own', () => {
    expect(() =>
      assertPendingSessionMayReach(new Request('http://localhost/client/index.html')),
    ).not.toThrow();
    expect(() => assertPendingSessionMayReach(new Request('http://localhost/admin'))).not.toThrow();
  });
});
