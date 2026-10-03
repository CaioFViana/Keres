import { describe, expect, it } from 'vitest';
import {
  canonicalRequest,
  canonicalResponse,
  HEADER_NONCE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  MAX_CLOCK_SKEW_SECONDS,
  NonceCache,
  newNonce,
  sha256Hex,
  sign,
  signatureMatches,
  signRequestHeaders,
  signResponseHeaders,
  verifyRequest,
  verifyResponse,
} from '../../../src/services/payments/connector/signing';

/** A fixed secret, fixed inputs and the signatures they must give: what a connector in another language checks itself against. */
const VECTOR = {
  secret: 'test-secret-test-secret-test-secret!!',
  request: {
    direction: 'connector-to-keres' as const,
    method: 'POST',
    path: '/api/payments/events',
    timestamp: 1700000000,
    nonce: 'AAAAAAAAAAAAAAAAAAAAAAAA',
    body: '{"events":[]}',
  },
  bodyHash: '24de1c4a19c43ad41b013f13dcd858c17b0daa7f33a53f19913e5b11366d1c2e',
  requestSignature: 'v1=c8e98127b68460723395fa63ea93f60e114bcc382d08a6ccaf7ab6a5f566e54a',
  response: {
    requestNonce: 'AAAAAAAAAAAAAAAAAAAAAAAA',
    status: 200,
    timestamp: 1700000001,
    body: '{"methods":[]}',
  },
  responseSignature: 'v1=26c1a04f4df27d910aef33971148a8f061757365126e2b22618c1646401397bf',
};

const SECRET = 'a'.repeat(32);
const OTHER = 'b'.repeat(32);
const NOW = 1_700_000_000_000;

/** A request of a connector's, signed as it would be, for Keres to verify. */
function incoming(over: Partial<Parameters<typeof signRequestHeaders>[1]> = {}, at = NOW) {
  const parts = {
    direction: 'connector-to-keres' as const,
    method: 'POST',
    path: '/api/payments/events',
    body: '{"events":[]}',
    ...over,
  };
  return { parts, headers: signRequestHeaders(SECRET, parts, at) };
}

const verify = (
  headers: Record<string, string | undefined>,
  over: Record<string, unknown> = {},
  nonces = new NonceCache(),
  now = NOW,
) =>
  verifyRequest({
    direction: 'connector-to-keres',
    method: 'POST',
    path: '/api/payments/events',
    headers,
    body: '{"events":[]}',
    secrets: [SECRET],
    nonces,
    now,
    ...over,
  });

describe('the format, pinned', () => {
  it('hashes the body with SHA-256 in hex', () => {
    expect(sha256Hex(VECTOR.request.body)).toBe(VECTOR.bodyHash);
  });

  it('writes the request as the scheme, the direction, the method, the path, the time, the nonce and the body hash', () => {
    expect(canonicalRequest(VECTOR.request).split('\n')).toEqual([
      'KERES-CONNECT-V1',
      'connector-to-keres',
      'POST',
      '/api/payments/events',
      '1700000000',
      'AAAAAAAAAAAAAAAAAAAAAAAA',
      VECTOR.bodyHash,
    ]);
    expect(sign(VECTOR.secret, canonicalRequest(VECTOR.request))).toBe(VECTOR.requestSignature);
  });

  it('writes an answer as the scheme, "response", the nonce it answers, the status, the time and the body hash', () => {
    expect(canonicalResponse(VECTOR.response).split('\n').slice(0, 5)).toEqual([
      'KERES-CONNECT-V1',
      'response',
      'AAAAAAAAAAAAAAAAAAAAAAAA',
      '200',
      '1700000001',
    ]);
    expect(sign(VECTOR.secret, canonicalResponse(VECTOR.response))).toBe(VECTOR.responseSignature);
  });

  it('upper-cases the method, so the signature does not depend on how it was spelled', () => {
    expect(canonicalRequest({ ...VECTOR.request, method: 'post' })).toBe(
      canonicalRequest(VECTOR.request),
    );
  });
});

describe('what a signature protects', () => {
  const base = canonicalRequest(VECTOR.request);

  it.each([
    ['the direction', { direction: 'keres-to-connector' as const }],
    ['the method', { method: 'PUT' }],
    ['the path', { path: '/api/payments/events?x=1' }],
    ['the time', { timestamp: 1700000001 }],
    ['the nonce', { nonce: 'BBBBBBBBBBBBBBBBBBBBBBBB' }],
    ['the body', { body: '{"events":[{}]}' }],
  ])('changes with %s', (_label, change) => {
    expect(sign(SECRET, canonicalRequest({ ...VECTOR.request, ...change }))).not.toBe(
      sign(SECRET, base),
    );
  });

  it('depends on the key', () => {
    expect(sign(SECRET, base)).not.toBe(sign(OTHER, base));
  });

  it('is recognised under the current key or the previous one, and not under any other', () => {
    const signature = sign(SECRET, base);

    expect(signatureMatches([SECRET], base, signature)).toBe(true);
    expect(signatureMatches([OTHER, SECRET], base, signature)).toBe(true);
    expect(signatureMatches([OTHER], base, signature)).toBe(false);
    expect(signatureMatches([], base, signature)).toBe(false);
  });

  it.each([
    ['nothing', undefined],
    ['an empty header', ''],
    ['no version', sign(SECRET, base).slice(3)],
    ['another version', sign(SECRET, base).replace('v1=', 'v2=')],
    ['a short one', 'v1=abcd'],
  ])('refuses %s', (_label, header) => {
    expect(signatureMatches([SECRET], base, header)).toBe(false);
  });
});

describe('verifying a request that arrives', () => {
  it('accepts one that is signed, recent and new', () => {
    expect(verify(incoming().headers)).toEqual({ ok: true });
  });

  it('refuses one whose headers are missing, and says it is missing', () => {
    const { headers } = incoming();
    for (const name of [HEADER_TIMESTAMP, HEADER_NONCE, HEADER_SIGNATURE]) {
      expect(verify({ ...headers, [name]: undefined })).toEqual({ ok: false, reason: 'missing' });
    }
    expect(verify({})).toEqual({ ok: false, reason: 'missing' });
  });

  it.each([
    ['a timestamp that is not a number', { [HEADER_TIMESTAMP]: 'yesterday' }],
    ['a timestamp with a sign', { [HEADER_TIMESTAMP]: '-1700000000' }],
    ['a nonce that is too short', { [HEADER_NONCE]: 'abc' }],
    ['a nonce with odd characters', { [HEADER_NONCE]: 'a'.repeat(16) + ' !' }],
  ])('refuses %s as malformed', (_label, change) => {
    expect(verify({ ...incoming().headers, ...change })).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('refuses a message too far from our clock, in the past or in the future, and takes one at the edge', () => {
    const { headers } = incoming({}, NOW);

    expect(verify(headers, {}, new NonceCache(), NOW + MAX_CLOCK_SKEW_SECONDS * 1000)).toEqual({
      ok: true,
    });
    expect(
      verify(
        incoming({}, NOW).headers,
        {},
        new NonceCache(),
        NOW + (MAX_CLOCK_SKEW_SECONDS + 1) * 1000,
      ),
    ).toEqual({ ok: false, reason: 'stale' });
    expect(
      verify(
        incoming({}, NOW).headers,
        {},
        new NonceCache(),
        NOW - (MAX_CLOCK_SKEW_SECONDS + 1) * 1000,
      ),
    ).toEqual({ ok: false, reason: 'stale' });
  });

  it('refuses a body that was changed on the way, a path that was, and a method that was', () => {
    const { headers } = incoming();

    expect(verify(headers, { body: '{"events":[{"x":1}]}' })).toEqual({
      ok: false,
      reason: 'signature',
    });
    expect(verify(headers, { path: '/api/payments/events?a=b' })).toEqual({
      ok: false,
      reason: 'signature',
    });
    expect(verify(headers, { method: 'PUT' })).toEqual({ ok: false, reason: 'signature' });
  });

  it('refuses one signed with another key', () => {
    const headers = signRequestHeaders(
      OTHER,
      {
        direction: 'connector-to-keres',
        method: 'POST',
        path: '/api/payments/events',
        body: '{"events":[]}',
      },
      NOW,
    );

    expect(verify(headers)).toEqual({ ok: false, reason: 'signature' });
  });

  it('refuses a message of the other direction, even under the same key: a request of ours is not a notice of theirs', () => {
    const { headers } = incoming({ direction: 'keres-to-connector' });

    expect(verify(headers)).toEqual({ ok: false, reason: 'signature' });
  });

  it('takes a message once: the same one again is a replay', () => {
    const nonces = new NonceCache();
    const { headers } = incoming();

    expect(verify(headers, {}, nonces)).toEqual({ ok: true });
    expect(verify(headers, {}, nonces)).toEqual({ ok: false, reason: 'replay' });
    // Another message, with its own nonce, is fine.
    expect(verify(incoming().headers, {}, nonces)).toEqual({ ok: true });
  });

  it('does not remember what failed: strangers cannot fill the cache, or use up a nonce the real sender will use', () => {
    const nonces = new NonceCache();
    const { headers } = incoming();

    expect(verify({ ...headers, [HEADER_SIGNATURE]: 'v1=' + '0'.repeat(64) }, {}, nonces)).toEqual({
      ok: false,
      reason: 'signature',
    });
    expect(nonces.size).toBe(0);
    expect(verify(headers, {}, nonces)).toEqual({ ok: true });
  });

  it('takes a message signed with the previous key while a key is being replaced', () => {
    const { headers } = incoming();

    expect(verify(headers, { secrets: [OTHER, SECRET] })).toEqual({ ok: true });
  });
});

describe('verifying an answer to a request of ours', () => {
  const answer = (over: Partial<Parameters<typeof signResponseHeaders>[1]> = {}, at = NOW) => {
    const parts = { requestNonce: 'N'.repeat(24), status: 200, body: '{"methods":[]}', ...over };
    return { parts, headers: signResponseHeaders(SECRET, parts, at) };
  };
  const check = (
    headers: Record<string, string | undefined>,
    over: Record<string, unknown> = {},
    now = NOW,
  ) =>
    verifyResponse({
      requestNonce: 'N'.repeat(24),
      status: 200,
      headers,
      body: '{"methods":[]}',
      secrets: [SECRET],
      now,
      ...over,
    });

  it('accepts one that is signed, recent and for this request', () => {
    expect(check(answer().headers)).toEqual({ ok: true });
  });

  it('refuses one that is not signed at all', () => {
    expect(check({})).toEqual({ ok: false, reason: 'missing' });
    expect(check({ [HEADER_TIMESTAMP]: 'x', [HEADER_SIGNATURE]: 'v1=00' })).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('refuses one that answers another request, so an old answer cannot be replayed for a new question', () => {
    expect(check(answer().headers, { requestNonce: 'M'.repeat(24) })).toEqual({
      ok: false,
      reason: 'signature',
    });
  });

  it('refuses a body or a status that was changed, and a stale answer', () => {
    const { headers } = answer();

    expect(check(headers, { body: '{"methods":[{"id":"x"}]}' })).toEqual({
      ok: false,
      reason: 'signature',
    });
    expect(check(headers, { status: 500 })).toEqual({ ok: false, reason: 'signature' });
    expect(check(headers, {}, NOW + (MAX_CLOCK_SKEW_SECONDS + 1) * 1000)).toEqual({
      ok: false,
      reason: 'stale',
    });
  });

  it('refuses an answer signed with the key of the other direction, which is another key', () => {
    const { headers } = answer();

    expect(check(headers, { secrets: [OTHER] })).toEqual({ ok: false, reason: 'signature' });
  });
});

describe('NonceCache', () => {
  it('forgets a nonce once its window has passed, and only then', () => {
    const cache = new NonceCache(1000);

    expect(cache.replayed('a'.repeat(16), 0)).toBe(false);
    expect(cache.replayed('a'.repeat(16), 1000)).toBe(true);
    expect(cache.replayed('a'.repeat(16), 1001)).toBe(false);
  });

  it('keeps to its size by letting the oldest go', () => {
    const cache = new NonceCache(60_000, 3);
    for (const [index, nonce] of ['a', 'b', 'c', 'd'].entries()) {
      cache.replayed(nonce.repeat(16), index);
    }

    expect(cache.size).toBe(3);
    // The first one was let go; the newest are still remembered.
    expect(cache.replayed('d'.repeat(16), 10)).toBe(true);
    expect(cache.replayed('a'.repeat(16), 10)).toBe(false);
  });

  it('makes nonces that are long enough, URL-safe and not repeated', () => {
    const nonces = new Set(Array.from({ length: 200 }, () => newNonce()));

    expect(nonces.size).toBe(200);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  });
});
