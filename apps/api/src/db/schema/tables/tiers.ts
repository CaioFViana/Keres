import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Plano de assinatura: define os tetos de uso que `TierEnforcementService` aplica.
 *
 * Convenção desta tabela: todas as colunas `max*` são nullable, e `null` significa
 * "ilimitado" - em vez de uma coluna `*Unlimited` separada para cada teto, o que
 * dobraria o número de colunas. Mesma ideia já usada em `deletedAt` no resto do schema.
 */
export const tiers = pgTable('tiers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  /** Conveniência para a UI; a fonte da verdade de qual tier novos cadastros recebem é `registrationSettings.defaultTierId`. */
  isDefault: boolean('is_default').notNull().default(false),
  maxStories: integer('max_stories'),
  maxEntitiesPerStory: integer('max_entities_per_story'),
  maxEntitiesTotal: integer('max_entities_total'),
  maxStorageBytesPerStory: integer('max_storage_bytes_per_story'),
  maxStorageBytesTotal: integer('max_storage_bytes_total'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const tiersRelations = relations(tiers, ({ many }) => ({
  users: many(users),
}));
