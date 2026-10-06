/**
 * @jest-environment node
 */
import { PAYMENT_WARNING_DAYS } from '@keres/shared/metadata/Payments';
import {
  evaluatePaymentNotice,
  formatMoney,
  isRenewalBeingConfirmed,
  isMethodSoldForOffer,
  offerForPlayProduct,
  offersFrom,
  playProductForOffer,
} from '../../src/utils/paymentPlans';

const tier = (over: Record<string, unknown>) => ({
  id: 'tier-1',
  name: 'Pro',
  isDefault: false,
  priceMonthlyCents: 1990,
  priceYearlyCents: 19900,
  maxStories: 50,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: null,
  maxStorageBytesPerStory: null,
  maxStorageBytesTotal: null,
  maxPublicationsPerDay: null,
  ...over,
});

describe('offersFrom', () => {
  it('offers the plans that are priced, with the intervals they are sold in', () => {
    const offers = offersFrom({
      currency: 'BRL',
      tiers: [
        tier({ id: 'both' }),
        tier({ id: 'monthly-only', priceYearlyCents: null }),
        tier({ id: 'yearly-only', priceMonthlyCents: null }),
      ],
    } as never);

    expect(offers.map((offer) => offer.tier.id)).toEqual(['both', 'monthly-only', 'yearly-only']);
    expect(offers[0].prices).toEqual([
      { interval: 'monthly', cents: 1990 },
      { interval: 'yearly', cents: 19900 },
    ]);
    expect(offers[1].prices).toEqual([{ interval: 'monthly', cents: 1990 }]);
    expect(offers[2].prices).toEqual([{ interval: 'yearly', cents: 19900 }]);
  });

  it('leaves out the free plan and the ones with no price: nobody pays for those', () => {
    const offers = offersFrom({
      currency: 'BRL',
      tiers: [
        tier({ id: 'free', priceMonthlyCents: 0, priceYearlyCents: 0 }),
        tier({ id: 'unpriced', priceMonthlyCents: null, priceYearlyCents: null }),
        tier({ id: 'paid' }),
      ],
    } as never);

    expect(offers.map((offer) => offer.tier.id)).toEqual(['paid']);
  });

  it('has no offers when the plans could not be read', () => {
    expect(offersFrom(null)).toEqual([]);
    expect(offersFrom(undefined)).toEqual([]);
  });
});

describe('store products', () => {
  const pro = tier({ playMonthlyProductId: 'plus_monthly', playYearlyProductId: 'plus_yearly' });

  it('names the store product selling a plan and period, null when not sold there', () => {
    expect(playProductForOffer(pro as never, 'monthly')).toBe('plus_monthly');
    expect(playProductForOffer(pro as never, 'yearly')).toBe('plus_yearly');
    expect(playProductForOffer(tier({}) as never, 'monthly')).toBeNull();
  });

  it('finds the plan and period a store product sells', () => {
    const tiers = [tier({ id: 'free' }), pro];
    expect(offerForPlayProduct(tiers as never, 'plus_monthly')).toEqual({
      tierId: 'tier-1',
      interval: 'monthly',
    });
    expect(offerForPlayProduct(tiers as never, 'plus_yearly')).toEqual({
      tierId: 'tier-1',
      interval: 'yearly',
    });
    expect(offerForPlayProduct(tiers as never, 'unknown_product')).toBeNull();
  });
});

describe('where a method sells a plan', () => {
  const web = { flow: 'redirect' } as never;
  const play = { flow: 'native', store: 'play' } as never;
  const monthly = tier({
    playMonthlyProductId: 'plus_monthly',
    playYearlyProductId: null,
    webMonthlyEnabled: false,
    webYearlyEnabled: true,
  });

  it('sells on the web only where the plan says so, and in the store only with a product', () => {
    expect(isMethodSoldForOffer(web, monthly as never, 'monthly')).toBe(false);
    expect(isMethodSoldForOffer(web, monthly as never, 'yearly')).toBe(true);
    expect(isMethodSoldForOffer(play, monthly as never, 'monthly')).toBe(true);
    expect(isMethodSoldForOffer(play, monthly as never, 'yearly')).toBe(false);
  });

  it('treats a plan from a server predating the flags as sold everywhere', () => {
    expect(isMethodSoldForOffer(web, tier({}) as never, 'monthly')).toBe(true);
  });
});

describe('formatMoney', () => {
  it('writes an amount in the minor unit as money in the language of the user', () => {
    expect(formatMoney(1990, 'BRL', 'en')).toBe('R$19.90');
    expect(formatMoney(19900, 'USD', 'en')).toBe('$199.00');
  });

  it('keeps a plain amount for a currency the platform does not know', () => {
    expect(formatMoney(1990, 'ZZZZZ', 'en')).toBe('19.90 ZZZZZ');
  });
});

describe('evaluatePaymentNotice', () => {
  const now = new Date('2026-04-01T12:00:00.000Z');
  const subscription = (over: Record<string, unknown> = {}) => ({
    status: 'active' as const,
    paidUntil: '2026-04-03T12:00:00.000Z',
    cancelAtPeriodEnd: false,
    ...over,
  });

  it('says nothing without a subscription', () => {
    expect(evaluatePaymentNotice(null, now)).toEqual({ kind: 'none' });
  });

  it('reminds that a payment is coming up once the end is within the warning days', () => {
    expect(evaluatePaymentNotice(subscription(), now)).toEqual({ kind: 'soon', daysLeft: 2 });
    const last = new Date(now.getTime() + PAYMENT_WARNING_DAYS * 24 * 60 * 60 * 1000);
    expect(
      evaluatePaymentNotice(subscription({ paidUntil: last.toISOString() }), now),
    ).toMatchObject({ kind: 'soon', daysLeft: PAYMENT_WARNING_DAYS });
  });

  it('leaves the user alone while there is plenty of time', () => {
    expect(
      evaluatePaymentNotice(subscription({ paidUntil: '2026-04-20T12:00:00.000Z' }), now),
    ).toEqual({
      kind: 'none',
    });
  });

  it('reminds that a payment is due once the period ran out unpaid', () => {
    expect(evaluatePaymentNotice(subscription({ status: 'due' }), now)).toEqual({ kind: 'due' });
  });

  it('says nothing while the renewal is being confirmed: the date passed, the server still holds it as paid', () => {
    const justEnded = subscription({ paidUntil: '2026-03-31T09:00:00.000Z' });

    expect(evaluatePaymentNotice(justEnded, now)).toEqual({ kind: 'none' });
    // If it does not come, the server marks it due and the reminder follows.
    expect(evaluatePaymentNotice({ ...justEnded, status: 'due' }, now)).toEqual({ kind: 'due' });
  });

  it('never reminds about a subscription that will not renew: there is nothing to pay', () => {
    expect(evaluatePaymentNotice(subscription({ cancelAtPeriodEnd: true }), now)).toEqual({
      kind: 'none',
    });
    expect(evaluatePaymentNotice(subscription({ status: 'canceled' }), now)).toEqual({
      kind: 'none',
    });
  });
});

describe('isRenewalBeingConfirmed', () => {
  const now = new Date('2026-04-01T12:00:00.000Z');
  const base = {
    status: 'active' as const,
    cancelAtPeriodEnd: false,
    complimentary: false,
    paidUntil: '2026-03-31T09:00:00.000Z',
  };

  it('is a renewing subscription whose date passed and that the server still holds as paid', () => {
    expect(isRenewalBeingConfirmed(base, now)).toBe(true);
  });

  it('is not one with time left, one that is due, ending, or given by an administrator', () => {
    expect(isRenewalBeingConfirmed({ ...base, paidUntil: '2026-04-20T12:00:00.000Z' }, now)).toBe(
      false,
    );
    expect(isRenewalBeingConfirmed({ ...base, status: 'due' }, now)).toBe(false);
    expect(isRenewalBeingConfirmed({ ...base, cancelAtPeriodEnd: true }, now)).toBe(false);
    expect(isRenewalBeingConfirmed({ ...base, complimentary: true }, now)).toBe(false);
  });
});
