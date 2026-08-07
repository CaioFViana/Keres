import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { tiers } from './tiers';

/**
 * Configuração global de cadastro. Tabela de uma linha só - `id` é sempre o literal
 * 'singleton', então o app localiza a linha por essa constante em vez de manter uma
 * tabela de lookup separada. `RegistrationSettingsService` cria essa linha sob demanda
 * na primeira leitura se ela ainda não existir, então nenhuma migração/seed precisa
 * inserir dados.
 */
export const REGISTRATION_SETTINGS_SINGLETON_ID = 'singleton';

export const registrationSettings = pgTable('registration_settings', {
  id: text('id').primaryKey(),
  isRegistrationOpen: boolean('is_registration_open').notNull().default(true),
  /** null = sem teto de usuários. */
  maxUsers: integer('max_users'),
  /**
   * Quando true, `isRegistrationOpen` é recalculado a cada tentativa de cadastro a
   * partir de `maxUsers` (usuários atuais < maxUsers), em vez de usar o valor gravado
   * abaixo. Quando false, `isRegistrationOpen` é a chave manual do administrador.
   */
  autoManage: boolean('auto_manage').notNull().default(false),
  defaultTierId: text('default_tier_id').references(() => tiers.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const registrationSettingsRelations = relations(registrationSettings, ({ one }) => ({
  defaultTier: one(tiers, {
    fields: [registrationSettings.defaultTierId],
    references: [tiers.id],
  }),
}));
