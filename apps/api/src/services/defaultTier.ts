import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '../db';
import { REGISTRATION_SETTINGS_SINGLETON_ID, registrationSettings, tiers } from '../db/schema';

/**
 * The default plan: what a person has when no plan was assigned to them (and what a new account is given). Its
 * single source of truth is the registration setting `defaultTierId`; the `isDefault` flag on a plan is the same
 * fact written on the plan's side, and the two are kept together - choosing one in the plan's form or in the
 * registration page sets the other.
 *
 * A server that only has the flag (the plan's checkbox used to be the only thing ticked, and it did nothing by
 * itself) is read as having that plan as its default, so what an administrator ticked as "default" is what
 * applies. Its own module, using only the database: plan enforcement asks it on almost every write, and the
 * services that change it (plans, registration) both need it.
 */

/** The plan flagged as default on its own record, when the setting names none: the first, if somebody ticked several. */
async function flaggedDefaultTierId(): Promise<string | null> {
  const flagged = await db.query.tiers.findFirst({
    where: and(eq(tiers.isDefault, true), eq(tiers.isDeleted, false)),
    orderBy: [asc(tiers.sortOrder), asc(tiers.name)],
    columns: { id: true },
  });
  return flagged?.id ?? null;
}

/** The default plan that applies now, or null when there is none (and so, no limits). */
export async function effectiveDefaultTierId(): Promise<string | null> {
  const settings = await db.query.registrationSettings.findFirst({
    where: eq(registrationSettings.id, REGISTRATION_SETTINGS_SINGLETON_ID),
    columns: { defaultTierId: true },
  });
  return settings?.defaultTierId ?? (await flaggedDefaultTierId());
}

/** Writes the flag on the plans: set on `tierId` (when there is one), clear on every other. */
export async function syncDefaultTierFlags(tierId: string | null): Promise<void> {
  await db
    .update(tiers)
    .set({ isDefault: false })
    .where(
      tierId ? and(eq(tiers.isDefault, true), ne(tiers.id, tierId)) : eq(tiers.isDefault, true),
    );
  if (tierId) {
    await db.update(tiers).set({ isDefault: true }).where(eq(tiers.id, tierId));
  }
}

/** Makes `tierId` the default plan (or none, with null): the setting and the flags, together. */
export async function setDefaultTier(tierId: string | null): Promise<void> {
  const now = new Date();
  await db
    .insert(registrationSettings)
    .values({ id: REGISTRATION_SETTINGS_SINGLETON_ID, defaultTierId: tierId })
    .onConflictDoUpdate({
      target: registrationSettings.id,
      set: { defaultTierId: tierId, updatedAt: now },
    });
  await syncDefaultTierFlags(tierId);
}

/** Whether the setting currently names this plan. */
export async function isSettingDefaultTier(tierId: string): Promise<boolean> {
  const settings = await db.query.registrationSettings.findFirst({
    where: eq(registrationSettings.id, REGISTRATION_SETTINGS_SINGLETON_ID),
    columns: { defaultTierId: true },
  });
  return settings?.defaultTierId === tierId;
}
