import { CheckoutCreateSchema } from '@keres/shared';
import { PaymentWebhookRejectedError } from '@keres/shared/payments/PaymentPlugin';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { checkoutService } from '../../services/payments/CheckoutService';
import { getPaymentPlugin } from '../../services/payments/PaymentPluginRegistry';
import { subscriptionService } from '../../services/payments/SubscriptionService';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/** A provider's notice is small; anything near this is not one. */
const WEBHOOK_MAX_BYTES = 256 * 1024;

/** The language the person's client speaks, for the provider's page: the primary tag of `Accept-Language`. */
export function languageOf(header: string | null | undefined): string {
  const first = header?.split(',')[0]?.trim().split(/[-;]/)[0]?.toLowerCase() ?? '';
  return /^[a-z]{2,3}$/.test(first) ? first : 'en';
}

/**
 * The provider's notices, mounted at `/api/payments/webhook`. Public: it is the provider calling, not a
 * signed-in user, and what proves it is the provider is the plugin's check of the signature - the plugin
 * gets the body exactly as it came, because a signature is computed over those bytes.
 *
 * It answers 200 once the notices are applied (or ignored, when they do not concern this server), 400 when
 * the plugin says the request is not authentic, and 500 when something failed on this side so the provider
 * tries again - applying a notice is idempotent, so a retry is always safe.
 */
export const paymentWebhookRoutes = new Elysia().post(
  '/webhook',
  async ({ body, request }) => {
    const plugin = getPaymentPlugin();
    if (!plugin) throw new AppError(404, 'Payments are not enabled on this server.');
    if (body.length > WEBHOOK_MAX_BYTES) throw new AppError(413, 'Request too large.');

    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });

    let events;
    try {
      events = await plugin.handleWebhook({ headers, rawBody: body });
    } catch (error) {
      if (error instanceof PaymentWebhookRejectedError) {
        throw new AppError(400, 'Webhook rejected.');
      }
      logger.error('Payment plugin failed on a webhook', error);
      throw new AppError(500, 'The notice could not be processed.');
    }
    const outcomes = await subscriptionService.applyEvents(plugin, events);
    return {
      received: events.length,
      applied: outcomes.filter((outcome) => outcome === 'applied').length,
    };
  },
  {
    // The raw text, whatever the content type says: the plugin verifies the signature over it.
    parse: 'text',
    body: t.String(),
    detail: {
      summary: "The payment provider's notices (verified by the payment plugin)",
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

  .get('/checkout/:id', ({ userId, params }) => checkoutService.get(userId, params.id), {
    params: t.Object({ id: t.String() }),
    detail: { summary: 'Where an attempt to pay stands', tags: ['Payments'] },
  })

  .post('/subscription/cancel', ({ userId }) => subscriptionService.cancel(userId), {
    detail: {
      summary: 'Stop the subscription renewing (it ends when the paid period does)',
      tags: ['Payments'],
    },
  });
