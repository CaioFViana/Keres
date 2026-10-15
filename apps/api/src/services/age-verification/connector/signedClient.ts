import type { ZodType } from 'zod';
import {
  HEADER_NONCE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  signRequestHeaders,
  verifyResponse,
} from './signing';

/** What went wrong in a call to the service, in a few kinds the callers can tell apart. */
export type VerifierFailure =
  | 'transport'
  | 'timeout'
  | 'signature'
  | 'status'
  | 'invalid'
  | 'too-large';

export class VerifierError extends Error {
  constructor(
    message: string,
    readonly failure: VerifierFailure,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'VerifierError';
  }
}

/** The most a service may answer with: a verification's answer is a few hundred bytes. */
export const MAX_RESPONSE_BYTES = 1024 * 1024;

export interface SignedClientOptions {
  /** Where the service is. A path in it is kept: the contract's paths are added after it. */
  baseUrl: string;
  /** The key Keres signs with (the first) and the keys it checks answers with (all of them, for a key being replaced). */
  secrets: readonly string[];
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * Calls a service the way the contract says: every request signed, every answer checked - signed, recent, for this
 * request - before a byte of it is read, then bounded, parsed and validated against the schema of that call. A
 * redirect is never followed (it would carry the signed request somewhere the operator did not name), and the
 * time spent is limited.
 */
export class SignedClient {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: SignedClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  private urlFor(path: string): string {
    const base = this.options.baseUrl.endsWith('/')
      ? this.options.baseUrl
      : `${this.options.baseUrl}/`;
    return new URL(path.replace(/^\//, ''), base).toString();
  }

  /**
   * `path` is the contract's own (`/v1/methods?currency=BRL`), which is also what is signed - not the address after a
   * proxy has had its way with it.
   */
  async call<T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    schema: ZodType<T>,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const signed = signRequestHeaders(
      this.options.secrets[0],
      { direction: 'keres-to-verifier', method, path, body: payload },
      this.now(),
    );
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(payload ? { 'content-type': 'application/json' } : {}),
      ...extraHeaders,
      ...signed,
    };

    let response: Response;
    try {
      response = await this.fetchImpl(this.urlFor(path), {
        method,
        headers,
        body: payload || undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new VerifierError(
        timedOut
          ? `The age-verification service did not answer in ${this.options.timeoutMs} ms.`
          : 'The age-verification service could not be reached.',
        timedOut ? 'timeout' : 'transport',
      );
    }

    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_RESPONSE_BYTES) {
      throw new VerifierError('The age-verification service answered with too much.', 'too-large');
    }
    const text = await response.text().catch(() => '');
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new VerifierError('The age-verification service answered with too much.', 'too-large');
    }

    const verdict = verifyResponse({
      requestNonce: signed[HEADER_NONCE],
      status: response.status,
      headers: {
        [HEADER_TIMESTAMP]: response.headers.get(HEADER_TIMESTAMP) ?? undefined,
        [HEADER_SIGNATURE]: response.headers.get(HEADER_SIGNATURE) ?? undefined,
      },
      body: text,
      secrets: this.options.secrets,
      now: this.now(),
    });
    if (!verdict.ok) {
      // Nothing of an answer that is not proven to be the service's is used - not even to say what it was.
      throw new VerifierError(
        `The age-verification service's answer was refused (${verdict.reason}).`,
        'signature',
        response.status,
      );
    }
    if (!response.ok) {
      throw new VerifierError(
        `The age-verification service answered ${response.status}.`,
        'status',
        response.status,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new VerifierError('The age-verification service did not answer in JSON.', 'invalid');
    }
    const checked = schema.safeParse(parsed);
    if (!checked.success) {
      const first = checked.error.issues[0];
      throw new VerifierError(
        `The age-verification service's answer is not what the contract says (${first?.path.join('.') || 'body'}: ${first?.message ?? 'invalid'}).`,
        'invalid',
      );
    }
    return checked.data;
  }
}
