import { describe, expect, it } from 'vitest';
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
