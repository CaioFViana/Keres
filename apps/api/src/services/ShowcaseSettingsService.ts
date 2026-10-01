import { themes } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { SHOWCASE_SETTINGS_SINGLETON_ID, showcaseSettings } from '../db/schema';
import { AppError } from '../utils/errors';

/** A header title, not a paragraph: trimmed, never blank, fits the public site's layout. */
export const SHOWCASE_SITE_NAME_MAX_LENGTH = 60;

export interface ShowcaseSettingsPatch {
  isShowcaseEnabled?: boolean;
  isHostedClientEnabled?: boolean;
  siteName?: string;
  sitePalette?: string;
}

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

  async update(patch: ShowcaseSettingsPatch) {
    const validated: ShowcaseSettingsPatch = {};
    if (patch.isShowcaseEnabled !== undefined) {
      validated.isShowcaseEnabled = patch.isShowcaseEnabled;
    }
    if (patch.isHostedClientEnabled !== undefined) {
      validated.isHostedClientEnabled = patch.isHostedClientEnabled;
    }
    if (patch.siteName !== undefined) {
      validated.siteName = validateSiteName(patch.siteName);
    }
    if (patch.sitePalette !== undefined) {
      validateSitePalette(patch.sitePalette);
      validated.sitePalette = patch.sitePalette;
    }
    await this.getOrCreate();
    const [updated] = await db
      .update(showcaseSettings)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(showcaseSettings.id, SHOWCASE_SETTINGS_SINGLETON_ID))
      .returning();
    return updated;
  }

  /** Records a logo upload; the bytes themselves go through `ShowcaseLogoStorageService`. */
  async setLogo(contentType: string) {
    await this.getOrCreate();
    const [updated] = await db
      .update(showcaseSettings)
      .set({ logoContentType: contentType, logoUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(showcaseSettings.id, SHOWCASE_SETTINGS_SINGLETON_ID))
      .returning();
    return updated;
  }

  /** Clears the logo reference; the bytes themselves go through `ShowcaseLogoStorageService`. */
  async clearLogo() {
    await this.getOrCreate();
    const [updated] = await db
      .update(showcaseSettings)
      .set({ logoContentType: null, logoUpdatedAt: null, updatedAt: new Date() })
      .where(eq(showcaseSettings.id, SHOWCASE_SETTINGS_SINGLETON_ID))
      .returning();
    return updated;
  }
}

function validateSiteName(siteName: string): string {
  const trimmed = siteName.trim();
  if (trimmed.length < 1 || trimmed.length > SHOWCASE_SITE_NAME_MAX_LENGTH) {
    throw new AppError(
      400,
      `Site name must be between 1 and ${SHOWCASE_SITE_NAME_MAX_LENGTH} characters.`,
    );
  }
  return trimmed;
}

function validateSitePalette(sitePalette: string): void {
  // `in` would also match `Object.prototype` members (`constructor`, ...); only own keys count.
  if (!Object.hasOwn(themes, sitePalette)) {
    throw new AppError(400, `Unknown site palette "${sitePalette}".`);
  }
}

export const showcaseSettingsService = new ShowcaseSettingsService();
