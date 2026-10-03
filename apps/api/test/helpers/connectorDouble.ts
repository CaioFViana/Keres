import {
  HEADER_NONCE,
  NonceCache,
  signResponseHeaders,
  verifyRequest,
} from '../../src/services/payments/connector/signing';

export const KERES_KEY = 'k'.repeat(40);
export const OLD_KEY = 'o'.repeat(40);

export interface Reply {
  status?: number;
  body?: unknown;
  rawBody?: string;
  /** Answers without a signature, or with one of another key. */
  unsigned?: boolean;
  key?: string;
  /** Signs for another request, or at another time. */
  nonce?: string;
  at?: number;
  /** What the double does instead of answering. */
  fail?: Error;
}

export interface Seen {
  method: string;
  path: string;
  body: string;
  headers: Headers;
  verified: boolean;
}

/**
 * A connector that keeps the contract, standing at the other end of an in-memory "network": it checks every request
 * of the server's (signature, direction, time, nonce), and signs every answer. A test changes what it answers, one
 * thing at a time, to see what the server does with an answer that is wrong in that one way.
 */
export function connectorDouble(
  over: { info?: Record<string, unknown>; replies?: Record<string, (seen: Seen) => Reply> } = {},
) {
  const seen: Seen[] = [];
  const nonces = new NonceCache();
  const info = {
    apiVersion: 1,
    id: 'acme',
    displayName: 'Acme Pay',
    capabilities: ['status', 'cancel', 'due'],
    ...over.info,
  };
  const replies: Record<string, (seen: Seen) => Reply> = {
    'GET /v1/info': () => ({ body: info }),
    'GET /v1/methods': () => ({
      body: {
        methods: [
          { id: 'card', label: 'Card' },
          { id: 'pix', label: 'PIX', recurring: false },
        ],
      },
    }),
    'POST /v1/checkouts': () => ({
      status: 201,
      body: {
        providerReference: 'ch_1',
        action: { kind: 'redirect', url: 'https://pay.acme.test/ch_1' },
        expiresAt: '2026-04-03T10:00:00.000Z',
      },
    }),
    'GET /v1/checkouts/c1': () => ({ body: { event: null } }),
    'POST /v1/subscriptions/sub_1/cancel': () => ({ body: {} }),
    'POST /v1/subscriptions/due': () => ({ body: {} }),
    ...over.replies,
  };

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : '';
    const path = url.pathname.replace(/^\/pay-base/, '') + url.search;
    const verdict = verifyRequest({
      direction: 'keres-to-connector',
      method: init?.method ?? 'GET',
      path,
      headers: Object.fromEntries(headers.entries()),
      body,
      secrets: [KERES_KEY],
      nonces,
    });
    const entry: Seen = {
      method: init?.method ?? 'GET',
      path,
      body,
      headers,
      verified: verdict.ok,
    };
    seen.push(entry);
    if (init?.redirect !== 'error') throw new Error('a redirect must never be followed');
    const route = `${entry.method} ${url.pathname.replace(/^\/pay-base/, '')}`;
    const reply = replies[route]?.(entry) ?? { status: 404, body: { error: 'no such route' } };
    if (reply.fail) throw reply.fail;
    const status = reply.status ?? 200;
    const text = reply.rawBody ?? JSON.stringify(reply.body ?? {});
    const answerHeaders: Record<string, string> = { 'content-type': 'application/json' };
    if (!reply.unsigned) {
      Object.assign(
        answerHeaders,
        signResponseHeaders(
          reply.key ?? KERES_KEY,
          { requestNonce: reply.nonce ?? headers.get(HEADER_NONCE) ?? '', status, body: text },
          reply.at,
        ),
      );
    }
    return new Response(text, { status, headers: answerHeaders });
  }) as typeof fetch;

  return { fetchImpl, seen };
}
