import { describe, expect, it } from 'vitest';
import { HttpVerifier } from '../../src/services/ageVerification/connector/HttpVerifier';
import { VerifierError } from '../../src/services/ageVerification/connector/signedClient';
import {
  HEADER_NONCE,
  NonceCache,
  signResponseHeaders,
  verifyRequest,
} from '../../src/services/ageVerification/connector/signing';
// A payment connector's answer, which the age-verification client must refuse.
import { signResponseHeaders as signPaymentsResponse } from '../../src/services/payments/connector/signing';

const KEY = 'k'.repeat(40);
const OTHER = 'o'.repeat(40);
const BASE = 'https://verify.acme.test/base';

const PROVIDER_REFERENCE = 'ref_1';
const VERIFICATION_ID = 'vf_1';
const STATUS_ROUTE = `GET /v1/verifications/${VERIFICATION_ID}`;
const CREATE_ROUTE = 'POST /v1/verifications';
const CANCEL_ROUTE = `POST /v1/verifications/${PROVIDER_REFERENCE}/cancel`;

interface Reply {
  status?: number;
  body?: unknown;
  rawBody?: string;
  /** Answers without a signature. */
  unsigned?: boolean;
  /** Signs with a key other than Keres' own. */
  key?: string;
  /** Signs with the payment connector's scheme, not the age-verification one. */
  paymentsScheme?: boolean;
  /** What the double does instead of answering. */
  fail?: Error;
}

interface Seen {
  method: string;
  path: string;
  body: string;
  headers: Headers;
  verified: boolean;
}

/**
 * A verification service that keeps the contract, at the other end of an in-memory "network": it checks every request
 * of the server's (signature, direction, time, nonce) and signs every answer. A test changes one thing of one answer to
 * see what the client does with an answer that is wrong in that one way.
 */
function verifierDouble(
  over: { info?: Record<string, unknown>; replies?: Record<string, () => Reply> } = {},
) {
  const seen: Seen[] = [];
  const nonces = new NonceCache();
  const info = {
    apiVersion: 1,
    id: 'acme-age',
    displayName: 'Acme Verify',
    capabilities: ['status', 'cancel'],
    ...over.info,
  };
  const replies: Record<string, () => Reply> = {
    'GET /v1/info': () => ({ body: info }),
    [CREATE_ROUTE]: () => ({
      status: 201,
      body: {
        providerReference: PROVIDER_REFERENCE,
        action: { kind: 'redirect', url: 'https://verify.acme.test/v/1' },
        expiresAt: '2026-04-03T10:00:00.000Z',
      },
    }),
    [STATUS_ROUTE]: () => ({ body: { event: null } }),
    [CANCEL_ROUTE]: () => ({ body: { ok: true } }),
    ...over.replies,
  };

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : '';
    const method = init?.method ?? 'GET';
    const route = `${method} ${url.pathname.replace(/^\/base/, '')}`;
    const path = url.pathname.replace(/^\/base/, '') + url.search;
    const verdict = verifyRequest({
      direction: 'keres-to-verifier',
      method,
      path,
      headers: Object.fromEntries(headers.entries()),
      body,
      secrets: [KEY],
      nonces,
    });
    seen.push({ method, path, body, headers, verified: verdict.ok });
    if (init?.redirect !== 'error') throw new Error('a redirect must never be followed');

    const reply = replies[route]?.() ?? { status: 404, body: { error: 'no such route' } };
    if (reply.fail) throw reply.fail;
    const status = reply.status ?? 200;
    const text = reply.rawBody ?? JSON.stringify(reply.body ?? {});
    const answerHeaders: Record<string, string> = { 'content-type': 'application/json' };
    if (!reply.unsigned) {
      const parts = { requestNonce: headers.get(HEADER_NONCE) ?? '', status, body: text };
      Object.assign(
        answerHeaders,
        reply.paymentsScheme
          ? signPaymentsResponse(reply.key ?? KEY, parts)
          : signResponseHeaders(reply.key ?? KEY, parts),
      );
    }
    return new Response(text, { status, headers: answerHeaders });
  }) as typeof fetch;

  return { fetchImpl, seen };
}

/** A double in which one route answers `reply`, and every other route as the contract says. */
const doubleAnswering = (route: string, reply: () => Reply) =>
  verifierDouble({ replies: { [route]: reply } });

const connect = (
  double: ReturnType<typeof verifierDouble>,
  options: Partial<Parameters<typeof HttpVerifier.connect>[0]> = {},
) =>
  HttpVerifier.connect({
    baseUrl: BASE,
    secrets: [KEY],
    timeoutMs: 2000,
    allowInsecure: false,
    fetchImpl: double.fetchImpl,
    ...options,
  });

const request = {
  verificationId: VERIFICATION_ID,
  subject: { userId: 'u_1', username: 'maria' },
  language: 'pt-BR',
};

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as VerifierError;
  }
  throw new Error('it was not refused');
};

const redirectTo = (url: string) => () => ({
  status: 201,
  body: { providerReference: PROVIDER_REFERENCE, action: { kind: 'redirect', url } },
});

describe('connecting', () => {
  it('learns who the service is and what it can do, and has only that', async () => {
    const verifier = await connect(verifierDouble());

    expect(verifier.id).toBe('acme-age');
    expect(verifier.displayName).toBe('Acme Verify');
    expect(verifier.capabilities).toEqual(['status', 'cancel']);
    expect(verifier.getVerificationStatus).toBeTypeOf('function');
    expect(verifier.cancelVerification).toBeTypeOf('function');
  });

  it('has none of the optional parts the service did not say it implements', async () => {
    const none = await connect(verifierDouble({ info: { capabilities: [] } }));
    const cancelOnly = await connect(verifierDouble({ info: { capabilities: ['cancel'] } }));

    expect(none.getVerificationStatus).toBeUndefined();
    expect(none.cancelVerification).toBeUndefined();
    expect(cancelOnly.getVerificationStatus).toBeUndefined();
    expect(cancelOnly.cancelVerification).toBeTypeOf('function');
  });

  it('holds the service to the contract version this server speaks', async () => {
    const error = await rejection(connect(verifierDouble({ info: { apiVersion: 2 } })));

    expect(error).toBeInstanceOf(VerifierError);
    expect(error.failure).toBe('invalid');
  });

  it('refuses an info answer that is not signed by the service', async () => {
    const error = await rejection(connect(doubleAnswering('GET /v1/info', () => ({ key: OTHER }))));

    expect(error.failure).toBe('signature');
  });

  it('refuses an info answer with no signature at all', async () => {
    const error = await rejection(
      connect(doubleAnswering('GET /v1/info', () => ({ unsigned: true }))),
    );

    expect(error.failure).toBe('signature');
  });

  it('refuses an answer signed with the payment connector scheme, even under the same key', async () => {
    const error = await rejection(
      connect(doubleAnswering('GET /v1/info', () => ({ paymentsScheme: true }))),
    );

    expect(error.failure).toBe('signature');
  });

  it('says what it could not do, not what the network answered', async () => {
    const error = await rejection(
      connect(doubleAnswering('GET /v1/info', () => ({ fail: new Error('ECONNREFUSED') }))),
    );

    expect(error.failure).toBe('transport');
    expect(error.message).toContain('age-verification service');
    expect(error.message).not.toContain('ECONNREFUSED');
  });

  it('refuses an answer that did not arrive in time, and says so', async () => {
    const timeout = Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' });

    const error = await rejection(
      connect(
        doubleAnswering('GET /v1/info', () => ({ fail: timeout })),
        { timeoutMs: 1500 },
      ),
    );

    expect(error.failure).toBe('timeout');
    expect(error.message).toContain('1500 ms');
  });

  it('refuses a service answer that is not JSON, and an error status', async () => {
    const notJson = await rejection(
      connect(doubleAnswering('GET /v1/info', () => ({ rawBody: 'hello' }))),
    );
    const unavailable = await rejection(
      connect(doubleAnswering('GET /v1/info', () => ({ status: 503, body: {} }))),
    );

    expect(notJson.failure).toBe('invalid');
    expect(unavailable.failure).toBe('status');
    expect(unavailable.status).toBe(503);
  });
});

describe('creating a verification', () => {
  it('sends the request, signed, with its verification id as the idempotency key, and maps the answer', async () => {
    const double = verifierDouble();
    const verifier = await connect(double);

    const result = await verifier.createVerification(request);

    const sent = double.seen.find((entry) => entry.path === '/v1/verifications');
    expect(sent?.verified).toBe(true);
    expect(JSON.parse(sent?.body ?? '{}')).toEqual(request);
    expect(sent?.headers.get('idempotency-key')).toBe(VERIFICATION_ID);
    expect(result.providerReference).toBe(PROVIDER_REFERENCE);
    expect(result.action).toEqual({ kind: 'redirect', url: 'https://verify.acme.test/v/1' });
  });

  it('turns the expiry into a date', async () => {
    const verifier = await connect(verifierDouble());

    const result = await verifier.createVerification(request);

    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt?.toISOString()).toBe('2026-04-03T10:00:00.000Z');
  });

  it('does not send a request the contract would refuse', async () => {
    const double = verifierDouble();
    const verifier = await connect(double);
    const sentBefore = double.seen.length;

    const error = await rejection(verifier.createVerification({ ...request, language: 'x' }));

    expect(error.failure).toBe('invalid');
    expect(double.seen.length).toBe(sentBefore);
  });

  it.each([
    ['https', 'https://verify.acme.test/v/1', true],
    ['plain http to this machine', 'http://localhost:8080/v/1', true],
    ['plain http to another machine', 'http://verify.acme.test/v/1', false],
    ['a javascript address', 'javascript:alert(1)', false],
    ['a data address', 'data:text/html,hello', false],
    ['not a URL', 'not a url', false],
  ])('sends the person to %s only when the address is allowed', async (_label, url, allowed) => {
    const verifier = await connect(doubleAnswering(CREATE_ROUTE, redirectTo(url)), {
      allowInsecure: false,
    });

    if (allowed) {
      expect((await verifier.createVerification(request)).action).toEqual({
        kind: 'redirect',
        url,
      });
    } else {
      const error = await rejection(verifier.createVerification(request));
      expect(error.failure).toBe('invalid');
      expect(error.message).toContain('https is required');
    }
  });

  it('allows plain http to another machine only when the operator said so', async () => {
    const url = 'http://verify.acme.test/v/1';
    const double = doubleAnswering(CREATE_ROUTE, redirectTo(url));

    const allowed = await connect(double, { allowInsecure: true });
    const refused = await connect(double, { allowInsecure: false });

    expect((await allowed.createVerification(request)).action).toEqual({ kind: 'redirect', url });
    expect((await rejection(refused.createVerification(request))).failure).toBe('invalid');
  });

  it('refuses an action of a kind the contract does not have', async () => {
    const verifier = await connect(
      doubleAnswering(CREATE_ROUTE, () => ({
        status: 201,
        body: { providerReference: PROVIDER_REFERENCE, action: { kind: 'sms', number: '1' } },
      })),
    );

    const error = await rejection(verifier.createVerification(request));

    expect(error).toBeInstanceOf(VerifierError);
    expect(error.failure).toBe('invalid');
  });

  it('clips what the service says to the person to what fits on a screen', async () => {
    const verifier = await connect(
      doubleAnswering(CREATE_ROUTE, () => ({
        status: 201,
        body: {
          providerReference: PROVIDER_REFERENCE,
          action: { kind: 'instructions', title: 'T'.repeat(300), text: 'x'.repeat(4000) },
        },
      })),
    );

    const result = await verifier.createVerification(request);

    expect(result.action).toEqual({
      kind: 'instructions',
      title: 'T'.repeat(120),
      text: 'x'.repeat(2000),
    });
  });

  it('refuses a creation that the service did not sign', async () => {
    const verifier = await connect(
      doubleAnswering(CREATE_ROUTE, () => ({
        status: 201,
        body: {
          providerReference: PROVIDER_REFERENCE,
          action: { kind: 'instructions', title: 'Title', text: 'Text' },
        },
        key: OTHER,
      })),
    );

    const error = await rejection(verifier.createVerification(request));

    expect(error.failure).toBe('signature');
  });

  it('reports a network that failed as a transport failure, and a late answer as a timeout', async () => {
    const down = await connect(
      doubleAnswering(CREATE_ROUTE, () => ({ fail: new Error('ECONNRESET') })),
    );
    const late = await connect(
      doubleAnswering(CREATE_ROUTE, () => ({
        fail: Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' }),
      })),
    );

    expect((await rejection(down.createVerification(request))).failure).toBe('transport');
    expect((await rejection(late.createVerification(request))).failure).toBe('timeout');
  });
});

describe('asking how a verification ended', () => {
  const approved = {
    type: 'verification.approved',
    eventId: 'evt_1',
    verificationId: VERIFICATION_ID,
    providerReference: PROVIDER_REFERENCE,
    decidedAt: '2026-04-02T09:00:00.000Z',
    method: 'manual-document-live-photo',
    identityCommitment: 'c'.repeat(64),
    discardedAt: '2026-04-02T09:00:01.000Z',
  };

  it('answers null while the verification is open', async () => {
    const verifier = await connect(verifierDouble());

    expect(await verifier.getVerificationStatus?.(VERIFICATION_ID, PROVIDER_REFERENCE)).toBeNull();
  });

  it('answers the ended verification, with its dates as dates', async () => {
    const verifier = await connect(
      doubleAnswering(STATUS_ROUTE, () => ({ body: { event: approved } })),
    );

    const event = await verifier.getVerificationStatus?.(VERIFICATION_ID, PROVIDER_REFERENCE);

    expect(event).toEqual({
      type: 'verification.approved',
      eventId: 'evt_1',
      verificationId: VERIFICATION_ID,
      providerReference: PROVIDER_REFERENCE,
      decidedAt: new Date('2026-04-02T09:00:00.000Z'),
      method: 'manual-document-live-photo',
      identityCommitment: 'c'.repeat(64),
      discardedAt: new Date('2026-04-02T09:00:01.000Z'),
    });
    expect(event?.type === 'verification.approved' && event.decidedAt).toBeInstanceOf(Date);
  });

  it('answers a refusal with its reason', async () => {
    const verifier = await connect(
      doubleAnswering(STATUS_ROUTE, () => ({
        body: {
          event: {
            type: 'verification.rejected',
            eventId: 'evt_2',
            verificationId: VERIFICATION_ID,
            providerReference: PROVIDER_REFERENCE,
            decidedAt: '2026-04-02T09:00:00.000Z',
            reason: 'document_unreadable',
            discardedAt: '2026-04-02T09:00:01.000Z',
          },
        },
      })),
    );

    const event = await verifier.getVerificationStatus?.(VERIFICATION_ID, PROVIDER_REFERENCE);

    expect(event?.type).toBe('verification.rejected');
    expect(event && 'reason' in event && event.reason).toBe('document_unreadable');
  });

  it('refuses an answer about another verification, even one the service signed', async () => {
    const verifier = await connect(
      doubleAnswering(STATUS_ROUTE, () => ({
        body: { event: { ...approved, verificationId: 'vf_other' } },
      })),
    );

    const error = await rejection(
      verifier.getVerificationStatus?.(VERIFICATION_ID, PROVIDER_REFERENCE) ??
        Promise.resolve(null),
    );

    expect(error.failure).toBe('invalid');
  });

  it('refuses an answer that is not signed by the service', async () => {
    const verifier = await connect(
      doubleAnswering(STATUS_ROUTE, () => ({ body: { event: null }, key: OTHER })),
    );

    const error = await rejection(
      verifier.getVerificationStatus?.(VERIFICATION_ID, PROVIDER_REFERENCE) ??
        Promise.resolve(null),
    );

    expect(error.failure).toBe('signature');
  });
});

describe('cancelling a verification', () => {
  it('asks the service to destroy the submission, by its reference, signed', async () => {
    const double = verifierDouble();
    const verifier = await connect(double);

    await verifier.cancelVerification?.(PROVIDER_REFERENCE);

    const sent = double.seen.find(
      (entry) => entry.method === 'POST' && entry.path.endsWith('/cancel'),
    );
    expect(sent?.path).toBe(`/v1/verifications/${PROVIDER_REFERENCE}/cancel`);
    expect(sent?.verified).toBe(true);
  });

  it('refuses a service that does not confirm it', async () => {
    const verifier = await connect(doubleAnswering(CANCEL_ROUTE, () => ({ body: { ok: false } })));

    const error = await rejection(
      verifier.cancelVerification?.(PROVIDER_REFERENCE) ?? Promise.resolve(),
    );

    expect(error.failure).toBe('invalid');
  });
});
