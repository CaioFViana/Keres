import { UpdateRegistrationSettings } from '@keres/shared';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { REGISTRATION_SETTINGS_SINGLETON_ID, registrationSettings, users } from '../db/schema';

/**
 * Configuração de cadastro é uma linha só (`id = 'singleton'`). Em vez de exigir um passo
 * de seed separado, a linha é criada com valores padrão na primeira leitura/escrita -
 * cadastro aberto, sem teto, sem gestão automática, sem tier padrão.
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

    // Corrida entre dois requests concorrentes na primeira leitura: o insert perdedor não
    // retorna linha (onConflictDoNothing), então busca a que o outro acabou de criar.
    return created ?? (await db.query.registrationSettings.findFirst({
      where: eq(registrationSettings.id, REGISTRATION_SETTINGS_SINGLETON_ID),
    }))!;
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
   * Avaliado ao vivo a cada tentativa de cadastro em vez de um job agendado (a API não
   * tem dependência de scheduler/queue) ou de confiar num booleano guardado que ficaria
   * desatualizado assim que `maxUsers` fosse alcançado.
   */
  async isOpenForRegistration(): Promise<boolean> {
    const settings = await this.getOrCreate();
    if (!settings.autoManage) {
      return settings.isRegistrationOpen;
    }
    if (settings.maxUsers === null) {
      return true;
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isDeleted, false));
    return count < settings.maxUsers;
  }
}

export const registrationSettingsService = new RegistrationSettingsService();
