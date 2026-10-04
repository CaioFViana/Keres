import { describe, expect, it } from 'vitest';
import {
  PlayRelayRequestSchema,
  PlayVerifyRequestSchema,
  PlayVerifyResponseSchema,
} from '../../schemas/PaymentConnectorSchemas';
import {
  AdminPaymentEventListQuerySchema,
  AdminSubscriptionListQuerySchema,
  CheckoutCreateSchema,
} from '../../schemas/PaymentSchemas';

describe('CheckoutCreateSchema', () => {
  it('takes a plan, an interval and a method', () => {
    expect(
      CheckoutCreateSchema.parse({ tierId: 't1', interval: 'yearly', methodId: 'pix' }),
    ).toEqual({ tierId: 't1', interval: 'yearly', methodId: 'pix' });
  });

  it.each([
    ['no plan', { interval: 'monthly', methodId: 'pix' }],
    ['an unknown interval', { tierId: 't1', interval: 'weekly', methodId: 'pix' }],
    ['no method', { tierId: 't1', interval: 'monthly' }],
    [
      'a method that is far too long',
      { tierId: 't1', interval: 'monthly', methodId: 'x'.repeat(65) },
    ],
  ])('refuses %s', (_label, body) => {
    expect(CheckoutCreateSchema.safeParse(body).success).toBe(false);
  });

  it('does not let a way to pay in: anything beyond its three fields is dropped', () => {
    const parsed = CheckoutCreateSchema.parse({
      tierId: 't1',
      interval: 'monthly',
      methodId: 'card',
      cardNumber: '4111111111111111',
    });
    expect(Object.keys(parsed).sort()).toEqual(['interval', 'methodId', 'tierId']);
  });
});

describe('the store purchase wire', () => {
  const verified = {
    userId: 'user-1',
    packageName: 'com.test.app',
    productId: 'plus_monthly',
    purchaseToken: 'token-abc',
    purchaseKind: 'subscription',
    amountCents: 1990,
    currency: 'BRL',
    checkoutId: 'checkout-1',
  };

  it('takes a token check naming the attempt and its price', () => {
    expect(PlayVerifyRequestSchema.parse(verified)).toMatchObject({
      productId: 'plus_monthly',
      amountCents: 1990,
      checkoutId: 'checkout-1',
    });
  });

  it.each([
    ['no token', { ...verified, purchaseToken: '' }],
    ['no product', { ...verified, productId: '' }],
    ['a bad kind', { ...verified, purchaseKind: 'lifetime' }],
  ])('refuses %s', (_label, body) => {
    expect(PlayVerifyRequestSchema.safeParse(body).success).toBe(false);
  });

  it('reads whether the token is real, and takes what the app names', () => {
    expect(PlayVerifyResponseSchema.parse({ ok: true, active: true, orderId: 'GPA.1' })).toEqual({
      ok: true,
      active: true,
      orderId: 'GPA.1',
    });
    expect(PlayVerifyResponseSchema.safeParse({ ok: true }).success).toBe(false);
    expect(
      PlayRelayRequestSchema.parse({
        tierId: 't1',
        interval: 'monthly',
        productId: 'plus_monthly',
        purchaseToken: 'token-abc',
        packageName: 'com.test.app',
      }),
    ).toMatchObject({ tierId: 't1', productId: 'plus_monthly' });
  });
});

describe('the admin list queries', () => {
  it('default to the ones that need attention first: the nearest end of period', () => {
    expect(AdminSubscriptionListQuerySchema.parse({})).toEqual({
      status: 'all',
      sort: 'paidUntil',
      order: 'asc',
      page: 1,
      pageSize: 25,
    });
    expect(AdminPaymentEventListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
  });

  it('read numbers from a query string and refuse a page size past the cap', () => {
    expect(AdminSubscriptionListQuerySchema.parse({ page: '3', pageSize: '50' })).toMatchObject({
      page: 3,
      pageSize: 50,
    });
    expect(AdminSubscriptionListQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
    expect(AdminSubscriptionListQuerySchema.safeParse({ status: 'paused' }).success).toBe(false);
  });
});
