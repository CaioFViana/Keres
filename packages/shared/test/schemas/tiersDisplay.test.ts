import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIERS_DISPLAY,
  PublicTiersResponseSchema,
  RegistrationSettingsSchema,
  TIERS_DISPLAYS,
  UpdateRegistrationSettingsSchema,
} from '../../index';

const publicTier = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  name: 'Pro',
  isDefault: false,
  priceMonthlyCents: null,
  priceYearlyCents: null,
  maxStories: 10,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: null,
  maxStorageBytesPerStory: null,
  maxStorageBytesTotal: null,
  maxPublicationsPerDay: null,
  maxPublishedArcs: null,
  maxCommentsPerStory: null,
  maxContributorsPerStory: null,
  playMonthlyProductId: null,
  playYearlyProductId: null,
  webMonthlyEnabled: false,
  webYearlyEnabled: false,
};

describe('tiers display mode', () => {
  it('is sale or info, with sale as the default', () => {
    expect(TIERS_DISPLAYS).toEqual(['sale', 'info']);
    expect(DEFAULT_TIERS_DISPLAY).toBe('sale');
  });

  it('is accepted on the registration settings update, and nothing else is', () => {
    expect(UpdateRegistrationSettingsSchema.parse({ tiersDisplay: 'info' })).toEqual({
      tiersDisplay: 'info',
    });
    expect(UpdateRegistrationSettingsSchema.safeParse({ tiersDisplay: 'free' }).success).toBe(
      false,
    );
    expect(UpdateRegistrationSettingsSchema.safeParse({ tiersDisplay: null }).success).toBe(false);
  });

  it('is part of the full settings row', () => {
    const row = {
      id: 'singleton',
      isRegistrationOpen: true,
      maxUsers: null,
      autoManage: false,
      allowNsfw: false,
      defaultTierId: null,
      currency: 'BRL',
      tiersDisplay: 'info',
      updatedAt: '2026-10-01T10:00:00.000Z',
    };
    expect(RegistrationSettingsSchema.parse(row).tiersDisplay).toBe('info');
    expect(RegistrationSettingsSchema.safeParse({ ...row, tiersDisplay: 'other' }).success).toBe(
      false,
    );
  });

  it('reads as sale on a public payload from a server that does not send it', () => {
    expect(PublicTiersResponseSchema.parse({ currency: 'BRL', tiers: [] }).display).toBe('sale');
  });

  it('parses an info payload, with the null prices and no sale flags', () => {
    const parsed = PublicTiersResponseSchema.parse({
      currency: 'BRL',
      display: 'info',
      tiers: [publicTier],
    });
    expect(parsed.display).toBe('info');
    expect(parsed.tiers[0]).toMatchObject({ priceMonthlyCents: null, webMonthlyEnabled: false });
  });

  it('rejects an unknown display on the public payload', () => {
    expect(
      PublicTiersResponseSchema.safeParse({ currency: 'BRL', display: 'free', tiers: [] }).success,
    ).toBe(false);
  });
});
