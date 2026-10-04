import {
  CheckoutRequestWireSchema,
  CheckoutResultWireSchema,
  CheckoutStatusResponseSchema,
  ConnectorInfoSchema,
  ConnectorMethodsResponseSchema,
  PlayVerifyRequestSchema,
} from '@keres/shared';
import type { PaymentsConfig } from './config';
import { pushEventsToKeres } from './keres';
import { playBillingMethods, playSucceededEvent, verifyPlayPurchase } from './playbilling';
import { NonceCache, signResponseHeaders, verifyRequest } from './protocol/signing';
import { activeProviders, connectorCapabilities, providerFor } from './providers';
import { mockDecide, mockPage, MOCK_METHOD_ID } from './providers/mock';
import { CheckoutStore, type Provider } from './providers/types';
import { storefrontPage, storeResultPage } from './storefront';
import type { PaymentEventWire } from './wire';

export interface ServiceState {
  config: PaymentsConfig;
  providers: Provider[];
  store: CheckoutStore;
  nonces: NonceCache;
  fetchImpl: typeof fetch;
  now: () => number;
  report: (events: PaymentEventWire[]) => Promise<void>;
}

export function createState(
  config: PaymentsConfig,
  overrides: Partial<Pick<ServiceState, 'fetchImpl' | 'now' | 'report' | 'providers'>> = {},
): ServiceState {
  const fetchImpl = overrides.fetchImpl ?? fetch;
  return {
    config,
    providers: overrides.providers ?? activeProviders(config),
    store: new CheckoutStore(),
    nonces: new NonceCache(),
    fetchImpl,
    now: overrides.now ?? Date.now,
    report: overrides.report ?? ((events) => pushEventsToKeres(config, events, fetchImpl)),
  };
}

function signedJson(
  state: ServiceState,
  requestNonce: string,
  status: number,
  payload: unknown,
): Response {
  const text = JSON.stringify(payload);
  const headers = signResponseHeaders(state.config.keresSecrets[0], {
    requestNonce,
    status,
    body: text,
  });
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

/** Verifies a Keres-signed `/v1/*` call. The logical path (with query) is what was signed. */
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
    now: state.now(),
  });
  if (!verdict.ok) {
    return new Response(JSON.stringify({ message: 'Refused.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
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

function resultPage(title: string, message: string, status = 200): Response {
  return new Response(storeResultPage(title, message, 'Back to the store'), {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

/** Shared browser return hop: the provider sent the person back, confirm and report if paid. */
async function providerReturn(
  state: ServiceState,
  reference: string,
  provider: Provider | undefined,
): Promise<Response> {
  if (!provider?.getStatus) return new Response('Not enabled.', { status: 404 });
  if (!reference) return new Response('Missing reference.', { status: 400 });
  try {
    const record = [...state.store.entries()].find(
      (entry) => entry[1].providerReference === reference,
    );
    const event = await provider.getStatus(record?.[0] ?? reference, reference, contextOf(state));
    if (event && event.type === 'payment.succeeded') {
      await state.report([event]);
      return resultPage('Payment confirmed', 'The payment was confirmed.');
    }
    return resultPage('Payment pending', 'The provider has not confirmed the payment yet.');
  } catch {
    return resultPage('Payment error', 'The payment could not be confirmed.', 502);
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

      if (request.method === 'GET' && url.pathname === '/') {
        const page = storefrontPage({
          keresBaseUrl: config.keresBaseUrl,
          displayName: config.connectorDisplayName,
          mockMode: providerFor(state.providers, MOCK_METHOD_ID) !== undefined,
        });
        return new Response(page, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }

      // Provider webhooks carry the provider's own proof, handled inside each provider.
      if (request.method === 'POST' && url.pathname === '/v1/paypal/webhook') {
        const provider = providerFor(state.providers, 'paypal');
        if (!provider?.handleWebhook)
          return Response.json({ message: 'Not enabled.' }, { status: 404 });
        try {
          const events = await provider.handleWebhook(request, contextOf(state));
          if (events.length > 0) await state.report(events);
          return Response.json({ ok: true });
        } catch (error) {
          return Response.json(
            { message: error instanceof Error ? error.message : 'Webhook rejected.' },
            { status: 400 },
          );
        }
      }
      if (request.method === 'POST' && url.pathname === '/v1/stripe/webhook') {
        const provider = providerFor(state.providers, 'googlepay');
        if (!provider?.handleWebhook)
          return Response.json({ message: 'Not enabled.' }, { status: 404 });
        try {
          const events = await provider.handleWebhook(request, contextOf(state));
          if (events.length > 0) await state.report(events);
          return Response.json({ ok: true });
        } catch (error) {
          return Response.json(
            { message: error instanceof Error ? error.message : 'Webhook rejected.' },
            { status: 400 },
          );
        }
      }

      // Browser return hops after an approval at the provider.
      if (request.method === 'GET' && url.pathname === '/v1/paypal/return') {
        return paypalReturn(state, url);
      }
      if (request.method === 'GET' && url.pathname === '/v1/stripe/return') {
        return stripeReturn(state, url);
      }

      // Mobile Play Billing verification, behind its own bearer secret.
      if (request.method === 'POST' && url.pathname === '/v1/play/verify') {
        return playVerify(state, request);
      }

      // Mock approval page (development only; the provider is absent unless mock-enabled).
      if (url.pathname === '/v1/mock/pay') {
        return mockPay(state, request, url);
      }

      if (!url.pathname.startsWith('/v1/')) {
        return Response.json({ message: 'Not found.' }, { status: 404 });
      }
      const auth = await verified(state, request, logicalPath);
      if (auth instanceof Response) return auth;
      const { nonce, bodyText } = auth;

      try {
        if (request.method === 'GET' && url.pathname === '/v1/info') {
          const info = {
            apiVersion: 1 as const,
            id: config.connectorId,
            displayName: config.connectorDisplayName,
            capabilities: connectorCapabilities(state.providers),
          };
          const checked = ConnectorInfoSchema.safeParse(info);
          if (!checked.success) return failure(state, nonce, 500, 'Invalid connector info.');
          return signedJson(state, nonce, 200, checked.data);
        }

        if (request.method === 'GET' && url.pathname === '/v1/methods') {
          const currency = url.searchParams.get('currency') ?? '';
          if (!/^[A-Z]{3}$/.test(currency)) {
            return failure(state, nonce, 400, 'Invalid currency.');
          }
          const methods = [
            ...state.providers.flatMap((provider) => provider.methods(currency)),
            ...playBillingMethods(state.config.play, currency),
          ];
          const checked = ConnectorMethodsResponseSchema.safeParse({ methods });
          if (!checked.success) return failure(state, nonce, 500, 'Invalid methods.');
          return signedJson(state, nonce, 200, checked.data);
        }

        if (request.method === 'POST' && url.pathname === '/v1/checkouts') {
          const parsed = CheckoutRequestWireSchema.safeParse(parseJson(bodyText));
          if (!parsed.success) return failure(state, nonce, 400, 'Invalid checkout request.');
          const provider = providerFor(state.providers, parsed.data.methodId);
          if (!provider) return failure(state, nonce, 400, 'Unknown payment method.');
          const result = await provider.createCheckout(parsed.data, contextOf(state));
          const checked = CheckoutResultWireSchema.safeParse(result);
          if (!checked.success) return failure(state, nonce, 502, 'Invalid provider answer.');
          return signedJson(state, nonce, 200, checked.data);
        }

        const checkoutMatch = /^\/v1\/checkouts\/([^/]+)$/.exec(url.pathname);
        if (request.method === 'GET' && checkoutMatch) {
          const checkoutId = decodeURIComponent(checkoutMatch[1]);
          const providerReference = url.searchParams.get('providerReference') ?? '';
          if (!providerReference) return failure(state, nonce, 400, 'Missing provider reference.');
          const record = state.store.recall(checkoutId);
          const candidates = record
            ? [providerFor(state.providers, record.methodId)].filter(
                (candidate): candidate is Provider => !!candidate,
              )
            : state.providers.filter((provider) => provider.hasStatus);
          for (const provider of candidates) {
            const event = await provider.getStatus?.(
              checkoutId,
              providerReference,
              contextOf(state),
            );
            if (event) {
              const checked = CheckoutStatusResponseSchema.safeParse({ event });
              if (!checked.success) return failure(state, nonce, 502, 'Invalid provider answer.');
              return signedJson(state, nonce, 200, checked.data);
            }
          }
          return signedJson(state, nonce, 200, { event: null });
        }

        const cancelMatch = /^\/v1\/subscriptions\/([^/]+)\/cancel$/.exec(url.pathname);
        if (request.method === 'POST' && cancelMatch) {
          const reference = decodeURIComponent(cancelMatch[1]);
          const provider = state.providers.find((candidate) => candidate.hasCancel);
          if (!provider?.cancelSubscription) {
            return failure(state, nonce, 400, 'Cancellation is not supported.');
          }
          await provider.cancelSubscription(reference, contextOf(state));
          return signedJson(state, nonce, 200, {});
        }

        if (request.method === 'POST' && url.pathname === '/v1/subscriptions/due') {
          return signedJson(state, nonce, 200, {});
        }

        return failure(state, nonce, 404, 'Not found.');
      } catch (error) {
        return failure(
          state,
          nonce,
          502,
          error instanceof Error ? error.message : 'The provider failed.',
        );
      }
    },
  };
}

function contextOf(state: ServiceState) {
  return {
    config: state.config,
    store: state.store,
    fetchImpl: state.fetchImpl,
    report: state.report,
  };
}

async function paypalReturn(state: ServiceState, url: URL): Promise<Response> {
  if (url.searchParams.get('cancelled') === '1') {
    return resultPage('Payment cancelled', 'The payment was cancelled.');
  }
  return providerReturn(
    state,
    url.searchParams.get('token') ?? '',
    providerFor(state.providers, 'paypal'),
  );
}

async function stripeReturn(state: ServiceState, url: URL): Promise<Response> {
  if (url.searchParams.get('cancelled') === '1') {
    return resultPage('Payment cancelled', 'The payment was cancelled.');
  }
  return providerReturn(
    state,
    url.searchParams.get('session_id') ?? '',
    providerFor(state.providers, 'googlepay'),
  );
}

async function mockPay(state: ServiceState, request: Request, url: URL): Promise<Response> {
  const html = (title: string, message: string): Response =>
    new Response(storeResultPage(title, message, 'Back to the store'), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  const registered = providerFor(state.providers, MOCK_METHOD_ID);
  if (!registered) return new Response('Not enabled.', { status: 404 });
  if (request.method === 'GET') {
    const checkoutId = url.searchParams.get('checkoutId') ?? '';
    const record = state.store.recall(checkoutId);
    if (!checkoutId || !record) return new Response('Unknown checkout.', { status: 404 });
    return new Response(
      mockPage({
        checkoutId,
        tierName: record.tierName ?? record.providerReference,
        amountCents: record.amountCents ?? 0,
        currency: record.currency ?? 'USD',
      }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const checkoutId = String(form?.get('checkoutId') ?? '');
    const verdict = form?.get('verdict');
    const record = state.store.recall(checkoutId);
    if (!checkoutId || !record || (verdict !== 'confirmed' && verdict !== 'rejected')) {
      return new Response('Invalid decision.', { status: 400 });
    }
    mockDecide(checkoutId, verdict);
    if (verdict === 'confirmed') {
      const event = await registered.getStatus?.(
        checkoutId,
        record.providerReference,
        contextOf(state),
      );
      if (event) await state.report([event]);
      return html(
        'Payment confirmed',
        'The mock provider confirmed the payment. Keres was notified.',
      );
    }
    return html('Payment failed', 'The mock provider rejected the payment.');
  }
  return new Response('Method not allowed.', { status: 405 });
}

async function playVerify(state: ServiceState, request: Request): Promise<Response> {
  const play = state.config.play;
  if (!play) return Response.json({ message: 'Not enabled.' }, { status: 404 });
  const authorization = request.headers.get('authorization') ?? '';
  if (authorization !== `Bearer ${play.endpointSecret}`) {
    return Response.json({ message: 'Refused.' }, { status: 401 });
  }
  const parsed = PlayVerifyRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'Invalid request.' }, { status: 400 });
  const serviceAccount = process.env.PLAY_SERVICE_ACCOUNT_JSON ?? '';
  try {
    const verification = await verifyPlayPurchase(
      { serviceAccountJson: serviceAccount, mock: play.mock },
      parsed.data,
      state.fetchImpl,
    );
    if (!verification.active) return Response.json({ ok: true, active: false });
    const event = playSucceededEvent(parsed.data, verification.orderId);
    await state.report([event]);
    return Response.json({ ok: true, active: true, orderId: verification.orderId });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : 'Verification failed.' },
      { status: 502 },
    );
  }
}
