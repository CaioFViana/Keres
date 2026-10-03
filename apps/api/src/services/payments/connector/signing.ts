import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * How Keres and a payment connector prove to each other that a message is theirs.
 *
 * Every request and every answer is signed with HMAC-SHA256 over a canonical string that names what it protects:
 * the direction (so a message of one kind cannot be passed off as the other), the method and the logical path (not
 * the address as a proxy rewrote it), a timestamp, a random nonce and the SHA-256 of the body. An answer also names
 * the nonce of the request it answers, so it cannot be replayed for another. The two directions use different keys.
 *
 * What that buys: an attacker who sees or alters traffic - even on a network with no TLS - cannot forge a request,
 * change a body, replay an old message (the timestamp is held to a short window and a nonce is accepted once) or turn
 * a request into an answer. What it does not buy is confidentiality: use TLS for that. The checks run in an order that
 * keeps unauthenticated callers from costing anything: shape, then time, then signature, and only then the nonce.
 *
 * The scheme is documented in `docs/payment_connectors.md`; a connector implements it on its own, in any language.
 */

export const SIGNATURE_SCHEME = 'KERES-CONNECT-V1';
export const SIGNATURE_PREFIX = 'v1=';
export const HEADER_TIMESTAMP = 'x-keres-timestamp';
export const HEADER_NONCE = 'x-keres-nonce';
export const HEADER_SIGNATURE = 'x-keres-signature';

/** How far a message's clock may be from ours, either way. */
export const MAX_CLOCK_SKEW_SECONDS = 300;

/** A secret shorter than this is refused: it is the only thing standing between the internet and the payments. */
export const MIN_SECRET_LENGTH = 32;

export type Direction = 'keres-to-connector' | 'connector-to-keres';

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const TIMESTAMP_PATTERN = /^\d{1,12}$/;

export const sha256Hex = (body: string | Uint8Array): string =>
  createHash('sha256').update(body).digest('hex');

export const newNonce = (): string => randomBytes(24).toString('base64url');

export interface RequestParts {
  direction: Direction;
  method: string;
  /** The logical path with its query string, as the contract names it (`/v1/methods?currency=BRL`). */
  path: string;
  timestamp: number;
  nonce: string;
  body: string | Uint8Array;
}

export function canonicalRequest(parts: RequestParts): string {
  return [
    SIGNATURE_SCHEME,
    parts.direction,
    parts.method.toUpperCase(),
    parts.path,
    String(parts.timestamp),
    parts.nonce,
    sha256Hex(parts.body),
  ].join('\n');
}

export interface ResponseParts {
  /** The nonce of the request this answers. */
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

export const sign = (secret: string, canonical: string): string =>
  `${SIGNATURE_PREFIX}${createHmac('sha256', secret).update(canonical).digest('hex')}`;

/** Whether `header` is the signature of `canonical` under any of `secrets` (the current one, then the previous). */
export function signatureMatches(
  secrets: readonly string[],
  canonical: string,
  header: string | undefined,
): boolean {
  if (!header?.startsWith(SIGNATURE_PREFIX)) return false;
  const received = Buffer.from(header);
  let matched = false;
  // Every secret is tried, whatever came before, so the time taken does not say which one fit.
  for (const secret of secrets) {
    const expected = Buffer.from(sign(secret, canonical));
    if (expected.length === received.length && timingSafeEqual(expected, received)) matched = true;
  }
  return matched;
}

/** Remembers the nonces seen in the window, so a message is accepted once. Bounded: the oldest are dropped first. */
export class NonceCache {
  private readonly seenAt = new Map<string, number>();

  constructor(
    private readonly ttlMs = (MAX_CLOCK_SKEW_SECONDS * 2 + 60) * 1000,
    private readonly maxEntries = 50_000,
  ) {}

  /** True when `nonce` was already seen (a replay); otherwise remembers it and returns false. */
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

  get size(): number {
    return this.seenAt.size;
  }
}

export type Rejection = 'missing' | 'malformed' | 'stale' | 'signature' | 'replay';

export type Verdict = { ok: true } | { ok: false; reason: Rejection };

const headerOf = (headers: Record<string, string | undefined>, name: string) => headers[name];

/** Whether `timestamp` (seconds) is within the allowed distance of `now` (ms). */
export function withinWindow(timestamp: number, now: number, skewSeconds = MAX_CLOCK_SKEW_SECONDS) {
  return Math.abs(Math.floor(now / 1000) - timestamp) <= skewSeconds;
}

export interface VerifyRequestInput {
  direction: Direction;
  method: string;
  path: string;
  /** Lower-cased names. */
  headers: Record<string, string | undefined>;
  body: string | Uint8Array;
  secrets: readonly string[];
  nonces: NonceCache;
  now?: number;
}

/** Checks a request that arrives (the connector's events). The reason is for the log, never for the caller. */
export function verifyRequest(input: VerifyRequestInput): Verdict {
  const now = input.now ?? Date.now();
  const timestampText = headerOf(input.headers, HEADER_TIMESTAMP);
  const nonce = headerOf(input.headers, HEADER_NONCE);
  const signature = headerOf(input.headers, HEADER_SIGNATURE);
  if (!timestampText || !nonce || !signature) return { ok: false, reason: 'missing' };
  if (!TIMESTAMP_PATTERN.test(timestampText) || !NONCE_PATTERN.test(nonce)) {
    return { ok: false, reason: 'malformed' };
  }
  const timestamp = Number(timestampText);
  if (!withinWindow(timestamp, now)) return { ok: false, reason: 'stale' };
  const canonical = canonicalRequest({
    direction: input.direction,
    method: input.method,
    path: input.path,
    timestamp,
    nonce,
    body: input.body,
  });
  if (!signatureMatches(input.secrets, canonical, signature)) {
    return { ok: false, reason: 'signature' };
  }
  // Only a message that proved itself is remembered: strangers cannot fill the cache.
  if (input.nonces.replayed(nonce, now)) return { ok: false, reason: 'replay' };
  return { ok: true };
}

export interface VerifyResponseInput {
  requestNonce: string;
  status: number;
  headers: Record<string, string | undefined>;
  body: string | Uint8Array;
  secrets: readonly string[];
  now?: number;
}

/** Checks an answer to a request of ours: signed, recent, for this request and no other. */
export function verifyResponse(input: VerifyResponseInput): Verdict {
  const now = input.now ?? Date.now();
  const timestampText = headerOf(input.headers, HEADER_TIMESTAMP);
  const signature = headerOf(input.headers, HEADER_SIGNATURE);
  if (!timestampText || !signature) return { ok: false, reason: 'missing' };
  if (!TIMESTAMP_PATTERN.test(timestampText)) return { ok: false, reason: 'malformed' };
  const timestamp = Number(timestampText);
  if (!withinWindow(timestamp, now)) return { ok: false, reason: 'stale' };
  const canonical = canonicalResponse({
    requestNonce: input.requestNonce,
    status: input.status,
    timestamp,
    body: input.body,
  });
  return signatureMatches(input.secrets, canonical, signature)
    ? { ok: true }
    : { ok: false, reason: 'signature' };
}

/** The headers of a request of ours. */
export function signRequestHeaders(
  secret: string,
  parts: Omit<RequestParts, 'timestamp' | 'nonce'>,
  now = Date.now(),
): Record<string, string> {
  const timestamp = Math.floor(now / 1000);
  const nonce = newNonce();
  return {
    [HEADER_TIMESTAMP]: String(timestamp),
    [HEADER_NONCE]: nonce,
    [HEADER_SIGNATURE]: sign(secret, canonicalRequest({ ...parts, timestamp, nonce })),
  };
}

/** The headers of an answer (what a connector sends; here so the tests, and anyone checking an implementation, can use it). */
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
