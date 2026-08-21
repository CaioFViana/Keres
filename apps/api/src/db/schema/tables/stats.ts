import { relations } from 'drizzle-orm';
import { boolean, index, integer, real, table, text, timestamp, timestampNow } from '../columns';
import { characters } from './characters';
import { modes } from './modes';
import { stories } from './stories';

/** Um eixo mensurável da história. Só os primários viram eixo do radar. */
export const stats = table('stats', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  name: text('name').notNull(),
  isPrimary: boolean('is_primary').notNull().default(true),
  order: integer('order').notNull().default(0),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

/**
 * Um degrau da escada de valores: o intervalo é `[minValue, minValue do próximo[`.
 *
 * `statId` nulo é a escada padrão da história. Sem índice único em (storyId, statId, minValue)
 * de propósito: no Postgres NULLs são distintos entre si, então a restrição não pegaria as
 * colisões da escada padrão - quem garante a unicidade é `StatStrengthSyncHandler`, que
 * levanta conflito de validação e deixa o cliente decidir.
 */
export const statStrengths = table(
  'stat_strengths',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    statId: text('stat_id').references(() => stats.id),
    label: text('label').notNull(),
    minValue: real('min_value').notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    ladderIdx: index('stat_strength_ladder_idx').on(table.storyId, table.statId),
  }),
);

/** O valor de um stat para um personagem. `modeId` nulo é o modo normal. */
export const statRelations = table(
  'stat_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id),
    modeId: text('mode_id').references(() => modes.id),
    statId: text('stat_id')
      .notNull()
      .references(() => stats.id),
    value: real('value').notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    // Mesma razão do índice acima: `modeId` anulável impede um único de verdade aqui.
    ownerIdx: index('stat_relation_owner_idx').on(table.storyId, table.characterId, table.modeId),
  }),
);

export const statsRelations = relations(stats, ({ one, many }) => ({
  story: one(stories, { fields: [stats.storyId], references: [stories.id] }),
  strengths: many(statStrengths),
  values: many(statRelations),
}));

export const statStrengthsRelations = relations(statStrengths, ({ one }) => ({
  story: one(stories, { fields: [statStrengths.storyId], references: [stories.id] }),
  stat: one(stats, { fields: [statStrengths.statId], references: [stats.id] }),
}));

export const statRelationsRelations = relations(statRelations, ({ one }) => ({
  story: one(stories, { fields: [statRelations.storyId], references: [stories.id] }),
  character: one(characters, { fields: [statRelations.characterId], references: [characters.id] }),
  mode: one(modes, { fields: [statRelations.modeId], references: [modes.id] }),
  stat: one(stats, { fields: [statRelations.statId], references: [stats.id] }),
}));
