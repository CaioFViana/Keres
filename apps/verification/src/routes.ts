import {
  VerificationCancelResponseSchema,
  VerificationRequestWireSchema,
  VerificationResultWireSchema,
  VerificationStatusResponseSchema,
  VerifierInfoSchema,
} from '@keres/shared';
import type { VerificationConfig } from './config';
import { NonceCache, signResponseHeaders, verifyRequest } from './protocol/signing';
import { PAGE_ROUTES } from './pages';
import type { Services } from './services';
import { openStores, type Stores } from './store/stores';
import {
  cancelSending,
  Conflict,
  endedEventOf,
  resultOf,
  startVerification,
  UnknownRetry,
} from './verifications';

/**
 * The `/v1` protocol of the service (`KERES-AGE-V1`, `docs/age_verification.md`): every request from Keres is verified
 * (signature under either accepted key, a fresh timestamp, a nonce seen once), every answer is signed with the current
 * key. The app is an ordinary fetch handler, so the tests drive it without a socket.
 *
 * Extension point for the upload page and the reviewer UI (a later task): a `PageRoute` is tried for every request
 * outside `/v1` and `/health`, in order, before the 404. The page task passes its routes to `createState`; this module
 * does not know what they serve.
 */

/** A page the service serves beside the protocol. Returns `undefined` when the request is not its. */
export type PageRoute = (
  request: Request,
  url: URL,
  state: ServiceState,
) => Promise<Response | undefined> | Response | undefined;

export interface ServiceState extends Services {
  nonces: NonceCache;
  pages: readonly PageRoute[];
}

export interface StateOptions {
  stores?: Stores;
  clock?: () => number;
  pages?: readonly PageRoute[];
}

export function createState(config: VerificationConfig, options: StateOptions = {}): ServiceState {
  return {
    config,
    stores: options.stores ?? openStores(config),
    clock: options.clock ?? Date.now,
    nonces: new NonceCache(),
    pages: options.pages ?? PAGE_ROUTES,
  };
}

function signedJson(
  state: ServiceState,
  requestNonce: string,
  status: number,
  payload: unknown,
): Response {
  const text = JSON.stringify(payload);
  const headers = signResponseHeaders(
    state.config.keresSecrets[0],
    { requestNonce, status, body: text },
    state.clock(),
  );
  return new Response(text, {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function failure(
  state: ServiceState,
  requestNonce: string,
  status: number,
  message: string,
): Response {
  return signedJson(state, requestNonce, status, { message });
}

/** Verifies a Keres-signed call. The logical path (with its query) is what was signed. */
async function verified(
  state: ServiceState,
  request: Request,
  logicalPath: string,
): Promise<{ nonce: string; bodyText: string } | Response> {
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });
  const bodyText = request.method === 'GET' ? '' : await request.text();
  const verdict = verifyRequest({
    method: request.method,
    path: logicalPath,
    headers,
    body: bodyText,
    secrets: state.config.keresSecrets,
    nonces: state.nonces,
    now: state.clock(),
  });
  if (!verdict.ok) {
    // The reason goes to the log, never to the caller: an attacker learns nothing from which check failed.
    console.warn(`Refused a request: ${verdict.reason}`);
    return Response.json({ message: 'Refused.' }, { status: 401 });
  }
  return { nonce: headers['x-keres-nonce'] as string, bodyText };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function createApp(state: ServiceState): { fetch: (request: Request) => Promise<Response> } {
  const { config } = state;

  return {
    fetch: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const logicalPath = `${url.pathname}${url.search}`;

      if (request.method === 'GET' && url.pathname === '/health') {
        return Response.json({ ok: true });
      }

      if (!url.pathname.startsWith('/v1/')) {
        for (const page of state.pages) {
          const response = await page(request, url, state);
          if (response) return response;
        }
        return Response.json({ message: 'Not found.' }, { status: 404 });
      }

      const auth = await verified(state, request, logicalPath);
      if (auth instanceof Response) return auth;
      const { nonce, bodyText } = auth;

      try {
        if (request.method === 'GET' && url.pathname === '/v1/info') {
          const checked = VerifierInfoSchema.safeParse({
            apiVersion: 1,
            id: config.serviceId,
            displayName: config.displayName,
            capabilities: ['status', 'cancel'],
          });
          if (!checked.success) return failure(state, nonce, 500, 'Invalid service info.');
          return signedJson(state, nonce, 200, checked.data);
        }

        if (request.method === 'POST' && url.pathname === '/v1/verifications') {
          const parsed = VerificationRequestWireSchema.safeParse(parseJson(bodyText));
          if (!parsed.success) return failure(state, nonce, 400, 'Invalid verification request.');
          const started = startVerification(state, parsed.data);
          const checked = VerificationResultWireSchema.safeParse(resultOf(state, started));
          if (!checked.success) return failure(state, nonce, 500, 'Invalid result.');
          return signedJson(state, nonce, 200, checked.data);
        }

        const statusMatch = /^\/v1\/verifications\/([^/]+)$/.exec(url.pathname);
        if (request.method === 'GET' && statusMatch) {
          const verificationId = decodeURIComponent(statusMatch[1] ?? '');
          const providerReference = url.searchParams.get('providerReference') ?? '';
          if (!providerReference) return failure(state, nonce, 400, 'Missing provider reference.');
          const row = state.stores.submissions.byVerificationId(verificationId);
          if (!row || row.providerReference !== providerReference) {
            return failure(state, nonce, 404, 'Not found.');
          }
          const checked = VerificationStatusResponseSchema.safeParse({
            event: endedEventOf(state, row),
          });
          if (!checked.success) return failure(state, nonce, 500, 'Invalid status.');
          return signedJson(state, nonce, 200, checked.data);
        }

        const cancelMatch = /^\/v1\/verifications\/([^/]+)\/cancel$/.exec(url.pathname);
        if (request.method === 'POST' && cancelMatch) {
          // Idempotent, and a reference nobody here knows is still "done": there is nothing to destroy.
          const providerReference = decodeURIComponent(cancelMatch[1] ?? '');
          const row = state.stores.submissions.byProviderReference(providerReference);
          if (row) cancelSending(state, row);
          return signedJson(
            state,
            nonce,
            200,
            VerificationCancelResponseSchema.parse({ ok: true }),
          );
        }

        return failure(state, nonce, 404, 'Not found.');
      } catch (error) {
        if (error instanceof Conflict || error instanceof UnknownRetry) {
          return failure(state, nonce, error instanceof Conflict ? 409 : 400, error.message);
        }
        console.error(
          `A verification call failed: ${error instanceof Error ? error.name : 'unknown'}`,
        );
        return failure(state, nonce, 500, 'The service failed.');
      }
    },
  };
}
