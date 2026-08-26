import type { UpdateRegistrationSettings } from '@keres/shared';
import { count, eq } from 'drizzle-orm';
import { db } from '../db';
import { REGISTRATION_SETTINGS_SINGLETON_ID, registrationSettings, users } from '../db/schema';

/**
 * Registration configuration is a single row (`id = 'singleton'`). Instead of requiring a separate
 * seed step, the row is created with default values on the first read/write - registration open, no
 * ceiling, no automatic management, no default tier.
 */
export class RegistrationSettingsService {
  async getOrCreate() {
    const existing = await db.query.registrationSettings.findFirst({
      where: eq(registrationSettings.id, REGISTRATION_SETTINGS_SINGLETON_ID),
    });
    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(registrationSettings)
      .values({ id: REGISTRATION_SETTINGS_SINGLETON_ID })
      .onConflictDoNothing()
      .returning();

    // A race between two concurrent requests on the first read: the losing insert returns no row
    // (onConflictDoNothing), so it fetches the one the other just created.
    return (
      created ??
      (await db.query.registrationSettings.findFirst({
        where: eq(registrationSettings.id, REGISTRATION_SETTINGS_SINGLETON_ID),
      }))!
    );
  }

  async update(patch: UpdateRegistrationSettings) {
    await this.getOrCreate();
    const [updated] = await db
      .update(registrationSettings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(registrationSettings.id, REGISTRATION_SETTINGS_SINGLETON_ID))
      .returning();
    return updated;
  }

  /**
   * Evaluated live on every signup attempt rather than by a scheduled job (the API has no
   * scheduler/queue dependency) or by trusting a stored boolean that would go stale the moment
   * `maxUsers` was reached.
   */
  async isOpenForRegistration(): Promise<boolean> {
    const settings = await this.getOrCreate();
    if (!settings.autoManage) {
      return settings.isRegistrationOpen;
    }
    if (settings.maxUsers === null) {
      return true;
    }
    const [{ total }] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.isDeleted, false));
    return total < settings.maxUsers;
  }
}

export const registrationSettingsService = new RegistrationSettingsService();
