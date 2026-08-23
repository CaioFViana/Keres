import { eq } from 'drizzle-orm';
import { db } from '../db';
import { SHOWCASE_SETTINGS_SINGLETON_ID, showcaseSettings } from '../db/schema';

/**
 * Configuração do Showcase, uma linha só (`id = 'singleton'`), criada com valores padrão na
 * primeira leitura - mesmo padrão de `RegistrationSettingsService`, sem passo de seed.
 *
 * O padrão é *desligado*: subir a API não pode, por si só, publicar um site aberto ao mundo.
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

    // Corrida entre dois requests na primeira leitura: o insert perdedor não retorna linha.
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
