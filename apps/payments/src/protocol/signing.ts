import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The connector side of `KERES-CONNECT-V1` - the same protocol
 * `apps/api/src/services/payments/connector/signing.ts` implements for the server side. Kept as
 * its own copy on purpose: this service ships alone in its own image and cannot import the
 * server's code. The two copies are held together by the conformance tests (`test/signing.test.ts`),
 * which pin the canonical strings, and by `docs/payment_connectors.md`, which is the contract.
 *
 * Summary: every request Keres sends is HMAC-SHA256 over
 * `KERES-CONNECT-V1\nkeres-to-connector\nMETHOD\n/path?query\ntimestamp\nnonce\nbody-sha256`,
 * every answer we send is HMAC over `KERES-CONNECT-V1\nresponse\nrequestNonce\nstatus\ntimestamp\nbody-sha256`.
 * The two directions use different keys; nonces are accepted once inside a 300s window.
 */

export const SIGNATURE_SCHEME = 'KERES-CONNECT-V1';
export const SIGNATURE_PREFIX = 'v1=';
export const HEADER_TIMESTAMP = 'x-keres-timestamp';
export const HEADER_NONCE = 'x-keres-nonce';
export const HEADER_SIGNATURE = 'x-keres-signature';
export const MAX_CLOCK_SKEW_SECONDS = 300;

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const TIMESTAMP_PATTERN = /^\d{1,12}$/;

/** Compares two secrets without leaking, through timing, how much of one matched the other. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}

export const sha256Hex = (body: string | Uint8Array): string =>
  createHash('sha256').update(body).digest('hex');

export const newNonce = (): string => randomBytes(24).toString('base64url');

export interface RequestParts {
  method: string;
  /** The logical path with its query string, exactly as the contract names it. */
  path: string;
  timestamp: number;
  nonce: string;
  body: string | Uint8Array;
}

export function canonicalRequest(parts: RequestParts): string {
  return [
    SIGNATURE_SCHEME,
    'keres-to-connector',
    parts.method.toUpperCase(),
    parts.path,
    String(parts.timestamp),
    parts.nonce,
    sha256Hex(parts.body),
  ].join('\n');
}

export interface ResponseParts {
  requestNonce: string;
  status: number;
  timestamp: number;
  body: string | Uint8Array;
}

export function canonicalResponse(parts: ResponseParts): string {
  return [
    SIGNATURE_SCHEME,
    'response',
    parts.requestNonce,
    String(parts.status),
    String(parts.timestamp),
    sha256Hex(parts.body),
  ].join('\n');
}

/** An event push to Keres: a request in the other direction, under the events key. */
export function canonicalEventPush(
  method: string,
  path: string,
  timestamp: number,
  nonce: string,
  body: string | Uint8Array,
): string {
  return [
    SIGNATURE_SCHEME,
    'connector-to-keres',
    method.toUpperCase(),
    path,
    String(timestamp),
    nonce,
    sha256Hex(body),
  ].join('\n');
}

export const sign = (secret: string, canonical: string): string =>
  `${SIGNATURE_PREFIX}${createHmac('sha256', secret).update(canonical).digest('hex')}`;

export function signatureMatches(
  secrets: readonly string[],
  canonical: string,
  header: string | undefined,
): boolean {
  if (!header?.startsWith(SIGNATURE_PREFIX)) return false;
  const received = Buffer.from(header);
  let matched = false;
  for (const secret of secrets) {
    const expected = Buffer.from(sign(secret, canonical));
    if (expected.length === received.length && timingSafeEqual(expected, received)) matched = true;
  }
  return matched;
}

/** Remembers the nonces seen in the window, so a request is accepted once. */
export class NonceCache {
  private readonly seenAt = new Map<string, number>();

  constructor(
    private readonly ttlMs = (MAX_CLOCK_SKEW_SECONDS * 2 + 60) * 1000,
    private readonly maxEntries = 50_000,
  ) {}

  replayed(nonce: string, now: number): boolean {
    this.sweep(now);
    if (this.seenAt.has(nonce)) return true;
    if (this.seenAt.size >= this.maxEntries) {
      const oldest = this.seenAt.keys().next().value;
      if (oldest !== undefined) this.seenAt.delete(oldest);
    }
    this.seenAt.set(nonce, now);
    return false;
  }

  private sweep(now: number): void {
    for (const [nonce, at] of this.seenAt) {
      if (now - at <= this.ttlMs) break;
      this.seenAt.delete(nonce);
    }
  }
}

export type Rejection = 'missing' | 'malformed' | 'stale' | 'signature' | 'replay';
export type Verdict = { ok: true } | { ok: false; reason: Rejection };

/** Checks a request from the Keres server. The reason is for the log, never for the caller. */
export function verifyRequest(input: {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: string | Uint8Array;
  secrets: readonly string[];
  nonces: NonceCache;
  now?: number;
}): Verdict {
  const now = input.now ?? Date.now();
  const timestampText = input.headers[HEADER_TIMESTAMP];
  const nonce = input.headers[HEADER_NONCE];
  const signature = input.headers[HEADER_SIGNATURE];
  if (!timestampText || !nonce || !signature) return { ok: false, reason: 'missing' };
  if (!TIMESTAMP_PATTERN.test(timestampText) || !NONCE_PATTERN.test(nonce)) {
    return { ok: false, reason: 'malformed' };
  }
  const timestamp = Number(timestampText);
  if (Math.abs(Math.floor(now / 1000) - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: 'stale' };
  }
  const canonical = canonicalRequest({
    method: input.method,
    path: input.path,
    timestamp,
    nonce,
    body: input.body,
  });
  if (!signatureMatches(input.secrets, canonical, signature)) {
    return { ok: false, reason: 'signature' };
  }
  if (input.nonces.replayed(nonce, now)) return { ok: false, reason: 'replay' };
  return { ok: true };
}

/** The headers of an answer to the Keres server, signed with the connector key. */
export function signResponseHeaders(
  secret: string,
  parts: Omit<ResponseParts, 'timestamp'>,
  now = Date.now(),
): Record<string, string> {
  const timestamp = Math.floor(now / 1000);
  return {
    [HEADER_TIMESTAMP]: String(timestamp),
    [HEADER_SIGNATURE]: sign(secret, canonicalResponse({ ...parts, timestamp })),
  };
}

/** The headers of an event push to the Keres server, signed with the events key. */
export function signEventPushHeaders(
  secret: string,
  parts: { method: string; path: string; body: string | Uint8Array },
  now = Date.now(),
): Record<string, string> {
  const timestamp = Math.floor(now / 1000);
  const nonce = newNonce();
  return {
    [HEADER_TIMESTAMP]: String(timestamp),
    [HEADER_NONCE]: nonce,
    [HEADER_SIGNATURE]: sign(
      secret,
      canonicalEventPush(parts.method, parts.path, timestamp, nonce, parts.body),
    ),
  };
}
