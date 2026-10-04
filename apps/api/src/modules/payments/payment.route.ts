import {
  CheckoutCreateSchema,
  PaymentEventsRequestSchema,
  PlayRelayRequestSchema,
} from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { checkoutService } from '../../services/payments/CheckoutService';
import { eventsSecrets } from '../../services/payments/connector/config';
import { toPaymentEvent } from '../../services/payments/connector/events';
import {
  HEADER_NONCE,
  NonceCache,
  signResponseHeaders,
  verifyRequest,
} from '../../services/payments/connector/signing';
import { getPaymentConnector } from '../../services/payments/PaymentConnectorRegistry';
import { subscriptionService } from '../../services/payments/SubscriptionService';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/** What a connector's request may weigh: a batch of events is a few kilobytes. */
const EVENTS_MAX_BYTES = 256 * 1024;

/** The path the connector signs, as the contract names it: not the address after a proxy has rewritten it. */
const EVENTS_PATH = '/api/payments/events';

const eventNonces = new NonceCache();

/** The language the person's client speaks, for the provider's page: the primary tag of `Accept-Language`. */
export function languageOf(header: string | null | undefined): string {
  const first = header?.split(',')[0]?.trim().split(/[-;]/)[0]?.toLowerCase() ?? '';
  return /^[a-z]{2,3}$/.test(first) ? first : 'en';
}

/**
 * What the payment connector reports, mounted at `/api/payments/events`. Public in the sense that no user is signed
 * in - it is a service calling - and protected by what proves it is the connector: a signature over the method, the
 * path, a timestamp, a one-time nonce and the body (see `connector/signing.ts`), made with a key that is not the one
 * Keres signs its own requests with. An unproven request is refused before a byte of it is read as anything, and is
 * recorded in the activity record.
 *
 * It answers 200 once the events are applied (an event for something this server never opened is noted and
 * ignored), 401 when the request is not proven, 400 when it is proven but is not what the contract says, and 500 when
 * something failed on this side so the connector tries again - applying an event is idempotent, so a retry is always
 * safe. The answer is signed too, so the connector can tell it came from Keres.
 */
export const paymentEventsRoutes = new Elysia().post(
  '/events',
  async ({ body, request }) => {
    const connector = getPaymentConnector();
    const secrets = eventsSecrets();
    if (!connector || secrets.length === 0) {
      throw new AppError(404, 'Payments are not enabled on this server.');
    }
    if (body.length > EVENTS_MAX_BYTES) throw new AppError(413, 'Request too large.');

    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    const verdict = verifyRequest({
      direction: 'connector-to-keres',
      method: 'POST',
      path: EVENTS_PATH,
      headers,
      body,
      secrets,
      nonces: eventNonces,
    });
    if (!verdict.ok) {
      logger.warn(`A payment event request was refused (${verdict.reason}).`);
      // The same words whatever was wrong: a caller who is not the connector learns nothing from them.
      throw new AppError(401, 'Request rejected.');
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new AppError(400, 'The body is not JSON.');
    }
    const parsed = PaymentEventsRequestSchema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new AppError(
        400,
        `Invalid events (${first?.path.join('.') || 'body'}: ${first?.message ?? 'invalid'}).`,
      );
    }

    const events = parsed.data.events.map(toPaymentEvent);
    const outcomes = await subscriptionService.applyEvents(connector, events);
    const answer = JSON.stringify({
      received: events.length,
      applied: outcomes.filter((outcome) => outcome === 'applied').length,
    });
    return new Response(answer, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        ...signResponseHeaders(secrets[0], {
          requestNonce: headers[HEADER_NONCE],
          status: 200,
          body: answer,
        }),
      },
    });
  },
  {
    // The raw text, whatever the content type says: the signature is over those bytes.
    parse: 'text',
    body: t.String(),
    detail: {
      summary: "The payment connector's events (verified by their signature)",
      tags: ['Payments'],
    },
  },
);

const checkoutBody = t.Object({
  tierId: t.String(),
  interval: t.String(),
  methodId: t.String(),
});

/**
 * Payments for the signed-in user, mounted at `/api/payments`: whether this server sells plans and the
 * person's own subscription, opening an attempt to pay, following it, and stopping a renewal. With no
 * payment plugin `GET /` says `enabled: false` and everything else answers 404.
 */
export const paymentRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  .derive(({ user }) => {
    if (!user?.userId) {
      throw new AppError(401, 'Unauthorized: User not authenticated.');
    }
    return { userId: user.userId };
  })

  .get('/', ({ userId }) => subscriptionService.getInfo(userId), {
    detail: {
      summary: 'Whether this server sells plans, how, and where the user stands',
      tags: ['Payments'],
    },
  })

  .post(
    '/checkout',
    async ({ userId, body, request, set }) => {
      const parsed = CheckoutCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid payment request');
      }
      set.status = 201;
      return checkoutService.start(
        userId,
        parsed.data,
        languageOf(request.headers.get('accept-language')),
      );
    },
    {
      // Loose on purpose: the Zod schema is the real gate, and Elysia strips undeclared keys.
      body: checkoutBody,
      detail: { summary: 'Start paying for a plan', tags: ['Payments'] },
    },
  )

  .get(
    '/switch-quote',
    async ({ userId, query }) => {
      const parsed = CheckoutCreateSchema.pick({ tierId: true, interval: true }).safeParse(query);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid request');
      }
      return {
        quote: await subscriptionService.quoteSwitch(
          userId,
          parsed.data.tierId,
          parsed.data.interval,
        ),
      };
    },
    {
      query: t.Object({ tierId: t.String(), interval: t.String() }),
      detail: {
        summary: 'What changing to this plan would do to the time left on the current one',
        tags: ['Payments'],
      },
    },
  )

  .get('/checkout/:id', ({ userId, params }) => checkoutService.get(userId, params.id), {
    params: t.Object({ id: t.String() }),
    detail: { summary: 'Where an attempt to pay stands', tags: ['Payments'] },
  })

  .post(
    '/play/verify',
    async ({ userId, body }) => {
      const parsed = PlayRelayRequestSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid purchase');
      }
      return checkoutService.verifyStorePurchase(userId, parsed.data);
    },
    {
      // Loose on purpose: the Zod schema is the real gate, and Elysia strips undeclared keys.
      body: t.Object({
        tierId: t.String(),
        interval: t.String(),
        productId: t.String(),
        purchaseToken: t.String(),
        packageName: t.String(),
      }),
      detail: {
        summary: 'Relay an in-app purchase bought in the Android app',
        tags: ['Payments'],
      },
    },
  )

  .post('/subscription/cancel', ({ userId }) => subscriptionService.cancel(userId), {
    detail: {
      summary: 'Stop the subscription renewing (it ends when the paid period does)',
      tags: ['Payments'],
    },
  });
