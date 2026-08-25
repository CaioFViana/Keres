import { eq } from 'drizzle-orm';
import { db } from '../db';
import { SHOWCASE_SETTINGS_SINGLETON_ID, showcaseSettings } from '../db/schema';

/**
 * Showcase configuration, a single row (`id = 'singleton'`), created with default values on the
 * first read - the same pattern as `RegistrationSettingsService`, with no seed step.
 *
 * The default is *off*: bringing the API up must not, on its own, publish a site open to the world.
 */
export class ShowcaseSettingsService {
  async getOrCreate() {
    const existing = await db.query.showcaseSettings.findFirst({
      where: eq(showcaseSettings.id, SHOWCASE_SETTINGS_SINGLETON_ID),
    });
    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(showcaseSettings)
      .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID })
      .onConflictDoNothing()
      .returning();

    // A race between two requests on the first read: the losing insert returns no row.
    return (
      created ??
      (await db.query.showcaseSettings.findFirst({
        where: eq(showcaseSettings.id, SHOWCASE_SETTINGS_SINGLETON_ID),
      }))!
    );
  }

  async isEnabled(): Promise<boolean> {
    return (await this.getOrCreate()).isShowcaseEnabled;
  }

  async isHostedClientEnabled(): Promise<boolean> {
    return (await this.getOrCreate()).isHostedClientEnabled;
  }

  async update(patch: { isShowcaseEnabled?: boolean; isHostedClientEnabled?: boolean }) {
    await this.getOrCreate();
    const [updated] = await db
      .update(showcaseSettings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(showcaseSettings.id, SHOWCASE_SETTINGS_SINGLETON_ID))
      .returning();
    return updated;
  }
}

export const showcaseSettingsService = new ShowcaseSettingsService();
