import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalEventPush,
  canonicalRequest,
  canonicalResponse,
  NonceCache,
  sha256Hex,
  sign,
  signatureMatches,
  signEventPushHeaders,
  verifyEventPush,
  verifyRequest,
  type Rejection,
  type Verdict,
} from '../src/protocol/signing';

const KERES = 'test-keres-to-verifier-secret-0123456789';
const EVENTS = 'test-verifier-to-keres-events-secret-01';
const NONCE = 'abcdefghijklmnopqrstuvwx';
const NOW = 1_700_000_000_000;

function reasonOf(verdict: Verdict): Rejection {
  expect(verdict.ok).toBe(false);
  if (verdict.ok) throw new Error('unreachable');
  return verdict.reason;
}

const hmacHex = (secret: string, text: string): string =>
  createHmac('sha256', secret).update(text).digest('hex');

describe('KERES-AGE-V1 signing', () => {
  it('pins the canonical request string under the age scheme and direction', () => {
    const body = '{"verificationId":"v-1"}';
    const canonical = canonicalRequest({
      method: 'POST',
      path: '/v1/verifications',
      timestamp: 1700000000,
      nonce: NONCE,
      body,
    });
    // Written out here, not taken from the implementation: the tag and the direction are the contract.
    expect(canonical).toBe(
      [
        'KERES-AGE-V1',
        'keres-to-verifier',
        'POST',
        '/v1/verifications',
        '1700000000',
        NONCE,
        createHash('sha256').update(body).digest('hex'),
      ].join('\n'),
    );
    expect(sign(KERES, canonical)).toBe(`v1=${hmacHex(KERES, canonical)}`);
  });

  it('binds answers to the request nonce, under the same scheme tag', () => {
    expect(
      canonicalResponse({
        requestNonce: NONCE,
        status: 200,
        timestamp: 1700000000,
        body: '{"ok":true}',
      }).split('\n'),
    ).toEqual(['KERES-AGE-V1', 'response', NONCE, '200', '1700000000', sha256Hex('{"ok":true}')]);
  });

  it('signs event pushes in the verifier-to-keres direction, with the events key', () => {
    const body = '{"events":[]}';
    const canonical = canonicalEventPush(
      'post',
      '/api/age-verification/events',
      1700000000,
      NONCE,
      body,
    );
    expect(canonical.split('\n').slice(0, 3)).toEqual([
      'KERES-AGE-V1',
      'verifier-to-keres',
      'POST',
    ]);

    const headers = signEventPushHeaders(
      EVENTS,
      { method: 'POST', path: '/api/age-verification/events', body },
      NOW,
    );
    expect(headers['x-keres-timestamp']).toBe('1700000000');
    expect(headers['x-keres-nonce']).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    const verdict = verifyEventPush({
      method: 'POST',
      path: '/api/age-verification/events',
      headers,
      body,
      secrets: [EVENTS],
      nonces: new NonceCache(),
      now: NOW,
    });
    expect(verdict).toEqual({ ok: true });
  });

  it('refuses a payments signature: the same key and fields under KERES-CONNECT-V1 are not valid here', () => {
    const body = '{"methods":[]}';
    const payments = [
      'KERES-CONNECT-V1',
      'keres-to-connector',
      'GET',
      '/v1/info',
      String(1700000000),
      NONCE,
      sha256Hex(body),
    ].join('\n');
    expect(
      reasonOf(
        verifyRequest({
          method: 'GET',
          path: '/v1/info',
          headers: {
            'x-keres-timestamp': '1700000000',
            'x-keres-nonce': NONCE,
            'x-keres-signature': sign(KERES, payments),
          },
          body,
          secrets: [KERES],
          nonces: new NonceCache(),
          now: NOW,
        }),
      ),
    ).toBe('signature');
  });

  it('refuses a request signed for the other direction (an event push replayed as a request)', () => {
    const body = '{"events":[]}';
    const headers = signEventPushHeaders(
      KERES,
      { method: 'POST', path: '/v1/verifications', body },
      NOW,
    );
    expect(
      reasonOf(
        verifyRequest({
          method: 'POST',
          path: '/v1/verifications',
          headers,
          body,
          secrets: [KERES],
          nonces: new NonceCache(),
          now: NOW,
        }),
      ),
    ).toBe('signature');
  });

  it('refuses an event push signed with a Keres request key (the keys are separate)', () => {
    const body = '{"events":[]}';
    const headers = signEventPushHeaders(
      KERES,
      { method: 'POST', path: '/api/age-verification/events', body },
      NOW,
    );
    expect(
      reasonOf(
        verifyEventPush({
          method: 'POST',
          path: '/api/age-verification/events',
          headers,
          body,
          secrets: [EVENTS],
          nonces: new NonceCache(),
          now: NOW,
        }),
      ),
    ).toBe('signature');
  });

  it('accepts the previous key only while it is listed, and rejects a forged signature', () => {
    const previous = 'test-previous-keres-secret-0123456789';
    const canonical = canonicalRequest({
      method: 'POST',
      path: '/v1/verifications',
      timestamp: 1700000000,
      nonce: NONCE,
      body: '{}',
    });
    const header = sign(previous, canonical);
    expect(signatureMatches([KERES, previous], canonical, header)).toBe(true);
    expect(signatureMatches([KERES], canonical, header)).toBe(false);
    expect(signatureMatches([KERES], canonical, 'v1=00')).toBe(false);
    expect(signatureMatches([KERES], canonical, undefined)).toBe(false);
  });

  it('rejects missing, malformed, stale, forged and replayed requests, in that order', () => {
    const base = {
      method: 'GET',
      path: '/v1/info',
      body: '',
      secrets: [KERES],
      nonces: new NonceCache(),
      now: NOW,
    };
    expect(reasonOf(verifyRequest({ ...base, headers: {} }))).toBe('missing');
    expect(
      reasonOf(
        verifyRequest({
          ...base,
          headers: {
            'x-keres-timestamp': 'soon',
            'x-keres-nonce': NONCE,
            'x-keres-signature': 'v1=00',
          },
        }),
      ),
    ).toBe('malformed');
    expect(
      reasonOf(
        verifyRequest({
          ...base,
          headers: {
            'x-keres-timestamp': '1700000000',
            'x-keres-nonce': 'short',
            'x-keres-signature': 'v1=00',
          },
        }),
      ),
    ).toBe('malformed');
    const stale = {
      'x-keres-timestamp': String(1700000000 - 1000),
      'x-keres-nonce': NONCE,
      'x-keres-signature': 'v1=00',
    };
    expect(reasonOf(verifyRequest({ ...base, headers: stale }))).toBe('stale');
    const forged = {
      'x-keres-timestamp': '1700000000',
      'x-keres-nonce': NONCE,
      'x-keres-signature': 'v1=00',
    };
    expect(reasonOf(verifyRequest({ ...base, headers: forged }))).toBe('signature');

    const nonces = new NonceCache();
    const signed = {
      'x-keres-timestamp': '1700000000',
      'x-keres-nonce': NONCE,
      'x-keres-signature': sign(
        KERES,
        canonicalRequest({
          method: 'GET',
          path: '/v1/info',
          timestamp: 1700000000,
          nonce: NONCE,
          body: '',
        }),
      ),
    };
    expect(verifyRequest({ ...base, nonces, headers: signed }).ok).toBe(true);
    expect(reasonOf(verifyRequest({ ...base, nonces, headers: signed }))).toBe('replay');
  });

  it('forgets a nonce once it is outside the window', () => {
    const nonces = new NonceCache();
    expect(nonces.replayed(NONCE, NOW)).toBe(false);
    expect(nonces.replayed(NONCE, NOW + 1000)).toBe(true);
    expect(nonces.replayed(NONCE, NOW + 1000 * 60 * 60)).toBe(false);
  });
});
