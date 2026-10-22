import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The service side of `KERES-AGE-V1` - the signing scheme of `KERES-CONNECT-V1` (payments) with its own scheme tag,
 * so a payments signature is never valid here, and the two directions of this service:
 * `keres-to-verifier` (what Keres asks) and `verifier-to-keres` (what the service reports).
 *
 * Kept as its own copy on purpose: this service ships alone in its own image and imports nothing of Keres or of
 * the payments service. `test/signing.test.ts` pins the canonical strings, and `docs/compliance/age_verification.md` is the
 * contract.
 *
 * Summary: every request Keres sends is HMAC-SHA256 over
 * `KERES-AGE-V1\nkeres-to-verifier\nMETHOD\n/path?query\ntimestamp\nnonce\nbody-sha256`, every answer is HMAC over
 * `KERES-AGE-V1\nresponse\nrequestNonce\nstatus\ntimestamp\nbody-sha256`, and every event push is HMAC over
 * `KERES-AGE-V1\nverifier-to-keres\nMETHOD\n/path\ntimestamp\nnonce\nbody-sha256` under the events key. Nonces are
 * accepted once inside a 300 s window.
 */

export const SIGNATURE_SCHEME = 'KERES-AGE-V1';
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
    'keres-to-verifier',
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
    'verifier-to-keres',
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

interface VerifyInput {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: string | Uint8Array;
  secrets: readonly string[];
  nonces: NonceCache;
  now?: number;
}

/**
 * The shared check of both directions: the headers are present and well formed, the timestamp is inside the window,
 * the signature matches one of the accepted secrets, and the nonce is new. The reason is for the log, never the caller.
 */
function verifyCanonical(
  input: VerifyInput,
  canonicalOf: (timestamp: number, nonce: string) => string,
): Verdict {
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
  if (!signatureMatches(input.secrets, canonicalOf(timestamp, nonce), signature)) {
    return { ok: false, reason: 'signature' };
  }
  if (input.nonces.replayed(nonce, now)) return { ok: false, reason: 'replay' };
  return { ok: true };
}

/** Checks a request from the Keres server (its `/v1/*` calls). */
export function verifyRequest(input: VerifyInput): Verdict {
  return verifyCanonical(input, (timestamp, nonce) =>
    canonicalRequest({
      method: input.method,
      path: input.path,
      timestamp,
      nonce,
      body: input.body,
    }),
  );
}

/**
 * Checks an event push as the Keres server verifies it: the same headers, under the events key and the other
 * direction. The service itself never receives one; the fake Keres of the outbox tests uses this to prove what the
 * service signs.
 */
export function verifyEventPush(input: VerifyInput): Verdict {
  return verifyCanonical(input, (timestamp, nonce) =>
    canonicalEventPush(input.method, input.path, timestamp, nonce, input.body),
  );
}

/** The headers of an answer to the Keres server, signed with the current Keres key. */
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
