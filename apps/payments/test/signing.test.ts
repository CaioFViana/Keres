import { describe, expect, it } from 'vitest';
import {
  canonicalRequest,
  canonicalResponse,
  NonceCache,
  sha256Hex,
  sign,
  signatureMatches,
  verifyRequest,
  type Rejection,
  type Verdict,
} from '../src/protocol/signing';

function reasonOf(verdict: Verdict): Rejection {
  expect(verdict.ok).toBe(false);
  if (verdict.ok) throw new Error('unreachable');
  return verdict.reason;
}

/**
 * Conformance with `KERES-CONNECT-V1`. The first vector below was computed outside this
 * service (node:crypto, fixed inputs) and is pinned: if the canonical string or the HMAC
 * ever change shape, this fails before any Keres server talks to us.
 */
describe('connector signing', () => {
  it('pins the canonical request string and its HMAC', () => {
    const body = '{"methods":[]}';
    expect(sha256Hex(body)).toBe(
      '12b075d6cc7d142a4abe22c6c30f9d04d0f32f9e6c49feea459f3fc80110b0f1',
    );
    const canonical = canonicalRequest({
      method: 'GET',
      path: '/v1/methods?currency=BRL',
      timestamp: 1700000000,
      nonce: 'abcdefghijklmnopqrstuvwx',
      body,
    });
    expect(canonical).toBe(
      [
        'KERES-CONNECT-V1',
        'keres-to-connector',
        'GET',
        '/v1/methods?currency=BRL',
        '1700000000',
        'abcdefghijklmnopqrstuvwx',
        '12b075d6cc7d142a4abe22c6c30f9d04d0f32f9e6c49feea459f3fc80110b0f1',
      ].join('\n'),
    );
    expect(sign('test-secret-0123456789abcdef-test', canonical)).toBe(
      'v1=119dbb170630d6cd90bace641da5381757f92c5e16654c3ee94e810567330b7f',
    );
  });

  it('binds answers to the request nonce', () => {
    const canonical = canonicalResponse({
      requestNonce: 'request-nonce-12345678',
      status: 200,
      timestamp: 1700000000,
      body: '{"ok":true}',
    });
    expect(canonical.split('\n')).toEqual([
      'KERES-CONNECT-V1',
      'response',
      'request-nonce-12345678',
      '200',
      '1700000000',
      sha256Hex('{"ok":true}'),
    ]);
  });

  it('accepts the previous secret while one is being replaced', () => {
    const canonical = canonicalRequest({
      method: 'POST',
      path: '/v1/checkouts',
      timestamp: 1700000000,
      nonce: 'abcdefghijklmnopqrstuvwx',
      body: '{}',
    });
    const header = sign('previous-secret-0123456789abcdef', canonical);
    expect(
      signatureMatches(
        ['current-secret-0123456789abcdef', 'previous-secret-0123456789abcdef'],
        canonical,
        header,
      ),
    ).toBe(true);
    expect(signatureMatches(['current-secret-0123456789abcdef'], canonical, header)).toBe(false);
  });

  it('rejects missing, stale, forged and replayed requests in order', () => {
    const now = 1700000000 * 1000;
    const base = {
      method: 'GET',
      path: '/v1/info',
      body: '',
      secrets: ['test-secret-0123456789abcdef-test'],
      nonces: new NonceCache(),
      now,
    };
    expect(reasonOf(verifyRequest({ ...base, headers: {} }))).toBe('missing');
    const stale: Record<string, string> = {
      'x-keres-timestamp': '1600000000',
      'x-keres-nonce': 'abcdefghijklmnopqrstuvwx',
      'x-keres-signature': 'v1=00',
    };
    expect(reasonOf(verifyRequest({ ...base, headers: stale }))).toBe('stale');
    const forged: Record<string, string> = {
      'x-keres-timestamp': '1700000000',
      'x-keres-nonce': 'abcdefghijklmnopqrstuvwx',
      'x-keres-signature': 'v1=00',
    };
    expect(reasonOf(verifyRequest({ ...base, headers: forged }))).toBe('signature');
    const nonce = 'abcdefghijklmnopqrstuvwx';
    const headers: Record<string, string> = {
      'x-keres-timestamp': '1700000000',
      'x-keres-nonce': nonce,
      'x-keres-signature': sign(
        'test-secret-0123456789abcdef-test',
        canonicalRequest({
          method: 'GET',
          path: '/v1/info',
          timestamp: 1700000000,
          nonce,
          body: '',
        }),
      ),
    };
    expect(verifyRequest({ ...base, headers }).ok).toBe(true);
    expect(reasonOf(verifyRequest({ ...base, headers }))).toBe('replay');
  });
});
