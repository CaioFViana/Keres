import { describe, expect, it } from 'vitest';
import {
  ContactCreateSchema,
  CurrencySchema,
  PartialTierSchema,
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

describe('what a tier update may carry', () => {
  it('keeps to what it says: a field left out stays as it was, not reset to its default', () => {
    expect(PartialTierSchema.parse({ maxStories: 3 })).toEqual({ maxStories: 3 });
    expect(PartialTierSchema.parse({})).toEqual({});
    // Saying so is how a flag is changed.
    expect(
      PartialTierSchema.parse({ isDefault: false, isPublicForSale: true, sortOrder: 4 }),
    ).toEqual({
      isDefault: false,
      isPublicForSale: true,
      sortOrder: 4,
    });
  });

  it('still refuses what a tier may not be', () => {
    expect(PartialTierSchema.safeParse({ name: '' }).success).toBe(false);
    expect(PartialTierSchema.safeParse({ maxStories: -1 }).success).toBe(false);
    expect(PartialTierSchema.safeParse({ sortOrder: 1.5 }).success).toBe(false);
  });

  it('lets any ceiling be zero, which allows nothing, and keeps blank as unlimited', () => {
    const everythingAtZero = {
      name: 'Free',
      maxStories: 0,
      maxEntitiesPerStory: 0,
      maxEntitiesTotal: 0,
      maxStorageBytesPerStory: 0,
      maxStorageBytesTotal: 0,
      maxPublicationsPerDay: 0,
      maxMessagesPerDay: 0,
    };
    expect(TierCreateInputSchema.parse(everythingAtZero)).toMatchObject(everythingAtZero);
    expect(PartialTierSchema.parse({ maxStorageBytesTotal: 0 })).toEqual({
      maxStorageBytesTotal: 0,
    });
    expect(TierCreateInputSchema.parse({ name: 'Free', maxStories: null }).maxStories).toBeNull();
    for (const field of Object.keys(everythingAtZero).filter((key) => key !== 'name')) {
      expect(TierCreateInputSchema.safeParse({ name: 'T', [field]: -1 }).success).toBe(false);
    }
  });

  it('keeps the defaults of a tier that is created', () => {
    expect(TierCreateInputSchema.parse({ name: 'T' })).toMatchObject({
      isDefault: false,
      isPublicForSale: false,
      sortOrder: 0,
    });
  });
});
