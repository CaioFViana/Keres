import { describe, expect, it } from 'vitest';
import {
  ContactCreateSchema,
  CurrencySchema,
  PublicTiersResponseSchema,
  TierCreateInputSchema,
  UpdateRegistrationSettingsSchema,
  yearlyDiscountPercent,
} from '../../index';

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('public tier and contact contracts', () => {
  it('prices tiers in minor units, with zero as the free tier', () => {
    expect(
      TierCreateInputSchema.parse({ name: 'T', priceMonthlyCents: 0, priceYearlyCents: null }),
    ).toMatchObject({ priceMonthlyCents: 0, priceYearlyCents: null });
    expect(
      TierCreateInputSchema.parse({ name: 'T', priceMonthlyCents: 1990, isPublicForSale: true }),
    ).toMatchObject({ priceMonthlyCents: 1990, isPublicForSale: true });
    expect(TierCreateInputSchema.safeParse({ name: 'T', priceMonthlyCents: -1 }).success).toBe(
      false,
    );
    expect(TierCreateInputSchema.safeParse({ name: 'T', priceYearlyCents: 19.9 }).success).toBe(
      false,
    );
    expect(TierCreateInputSchema.safeParse({ name: 'T', sortOrder: 1.5 }).success).toBe(false);
  });

  it('accepts only ISO-4217 currency codes', () => {
    expect(CurrencySchema.parse('BRL')).toBe('BRL');
    expect(UpdateRegistrationSettingsSchema.parse({ currency: 'USD' })).toEqual({
      currency: 'USD',
    });
    for (const bad of ['brl', 'BR', 'BRL1', 'R$']) {
      expect(CurrencySchema.safeParse(bad).success).toBe(false);
    }
  });

  it('exposes the public tiers payload the landing page consumes', () => {
    const parsed = PublicTiersResponseSchema.parse({
      currency: 'BRL',
      tiers: [
        {
          id,
          name: 'Free',
          isDefault: true,
          priceMonthlyCents: 0,
          priceYearlyCents: null,
          maxStories: 2,
          maxEntitiesPerStory: null,
          maxEntitiesTotal: null,
          maxStorageBytesPerStory: null,
          maxStorageBytesTotal: null,
          maxPublicationsPerDay: 0,
        },
      ],
    });
    expect(parsed.tiers).toHaveLength(1);
    expect(PublicTiersResponseSchema.parse({ currency: 'BRL', tiers: [] }).tiers).toEqual([]);
  });

  it('derives the yearly discount instead of storing it', () => {
    expect(yearlyDiscountPercent(1000, 9600)).toBe(20);
    // 100*12 = 1200, (1 - 1000/1200) rounds to 17.
    expect(yearlyDiscountPercent(100, 1000)).toBe(17);
    expect(yearlyDiscountPercent(null, 1000)).toBeNull();
    expect(yearlyDiscountPercent(1000, null)).toBeNull();
    // Not cheaper than twelve months: no discount to advertise.
    expect(yearlyDiscountPercent(1000, 12000)).toBeNull();
    expect(yearlyDiscountPercent(1000, 13000)).toBeNull();
    // A free monthly tier has no yearly comparison.
    expect(yearlyDiscountPercent(0, 0)).toBeNull();
  });

  it('validates visitor contact messages', () => {
    expect(
      ContactCreateSchema.parse({
        subject: '  Plans  ',
        body: 'Do you offer yearly billing?',
        contactEmail: ' visitor@example.com ',
      }),
    ).toEqual({
      subject: 'Plans',
      body: 'Do you offer yearly billing?',
      contactEmail: 'visitor@example.com',
    });
    expect(
      ContactCreateSchema.safeParse({ subject: '', body: 'x', contactEmail: 'a@b.co' }).success,
    ).toBe(false);
    expect(
      ContactCreateSchema.safeParse({ subject: 'x', body: '   ', contactEmail: 'a@b.co' }).success,
    ).toBe(false);
    expect(
      ContactCreateSchema.safeParse({ subject: 'x', body: 'y', contactEmail: 'not-an-email' })
        .success,
    ).toBe(false);
    expect(
      ContactCreateSchema.safeParse({
        subject: 'x',
        body: 'y',
        contactEmail: 'a@b.co'.padEnd(255, 'x'),
      }).success,
    ).toBe(false);
  });
});
