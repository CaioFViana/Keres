import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { demoPayService, DemoProviderError } from '../../services/payments/demo/DemoPayService';
import { DEMO_PAY_PAGE } from '../../services/payments/demo/demoPayPage';
import { AppError } from '../../utils/errors';

/** The demo provider's errors, as the answers the page understands. */
async function asHttp<T>(work: () => T | Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DemoProviderError) throw new AppError(error.status, error.message);
    throw error;
  }
}

const chargeParams = t.Object({ id: t.String() });
const subscriptionParams = t.Object({ id: t.String() });

/**
 * The demo payment provider's hosted page and what it does, mounted at `/buy` - only when `PAYMENT_DEMO` is on.
 *
 * Like a real provider's checkout page, a payment is opened with nothing but its id (unguessable): whoever has
 * the address can pay it. What belongs to a person - their subscriptions at the provider - needs them signed in
 * to Keres (the login sets the cookie the rest of the API reads). Everything here is for trying the flow: the
 * "confirm that this was paid" button is exactly what a real provider must never offer.
 */
export const demoPayRoutes = new Elysia({ prefix: '/buy' })
  .decorate('user', null as JWTPayload | null)
  .get(
    '/',
    ({ set }) => {
      set.headers['content-type'] = 'text/html; charset=utf-8';
      set.headers['cache-control'] = 'no-store';
      return DEMO_PAY_PAGE;
    },
    { detail: { summary: 'Demo payment provider page (PAYMENT_DEMO only)', tags: ['Payments'] } },
  )

  // The payment itself: public, by its id.
  .get('/api/charge/:id', ({ params }) => asHttp(() => demoPayService.getCharge(params.id)), {
    params: chargeParams,
    detail: { summary: 'A demo payment, as its page shows it', tags: ['Payments'] },
  })
  .post('/api/charge/:id/pay', ({ params }) => asHttp(() => demoPayService.pay(params.id)), {
    params: chargeParams,
    detail: { summary: 'Demo: confirm a payment as paid', tags: ['Payments'] },
  })
  .post('/api/charge/:id/fail', ({ params }) => asHttp(() => demoPayService.fail(params.id)), {
    params: chargeParams,
    detail: { summary: 'Demo: fail a payment', tags: ['Payments'] },
  })
  .post('/api/charge/:id/expire', ({ params }) => asHttp(() => demoPayService.expire(params.id)), {
    params: chargeParams,
    detail: { summary: 'Demo: let a payment expire', tags: ['Payments'] },
  })

  // What belongs to the signed-in person.
  .derive(({ user }) => {
    if (!user?.userId) {
      throw new AppError(401, 'Unauthorized: User not authenticated.');
    }
    return { userId: user.userId, username: user.username };
  })
  .get(
    '/api/mine',
    ({ userId, username }) => ({
      user: { userId, username },
      ...demoPayService.overview(userId),
    }),
    {
      detail: { summary: 'Demo: the signed-in person at the provider', tags: ['Payments'] },
    },
  )
  .post(
    '/api/subscription/:id/renew',
    ({ userId, params, body }) =>
      asHttp(() =>
        demoPayService.renew(userId, params.id, body.outcome === 'failed' ? 'failed' : 'paid'),
      ),
    {
      params: subscriptionParams,
      body: t.Object({ outcome: t.Optional(t.String()) }),
      detail: { summary: 'Demo: the provider charges the subscription again', tags: ['Payments'] },
    },
  )
  .post(
    '/api/subscription/:id/cancel',
    ({ userId, params }) => asHttp(() => demoPayService.cancel(userId, params.id)),
    {
      params: subscriptionParams,
      detail: { summary: 'Demo: the provider cancels the subscription', tags: ['Payments'] },
    },
  )
  .post('/api/mine/lapse', ({ userId }) => demoPayService.lapse(userId), {
    detail: { summary: 'Demo: make the paid period run out now', tags: ['Payments'] },
  });
