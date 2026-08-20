import { relations } from 'drizzle-orm';
import { bigintNumber, index, integer, json, table, text, timestampNow, unique } from '../columns';
import type { StoryPublicationSnapshot } from '@keres/shared';
import { stories } from './stories';
import { users } from './users';

/**
 * Uma versão pública de uma história: o .zip imutável que o Showcase oferece para download.
 *
 * Deliberadamente fora do motor de sincronização - sem `version`, sem `isDeleted`, sem handler
 * em `entity-sync-handlers/`, sem entrada no log de operações. Publicar não é uma edição da
 * história; é um objeto paralelo, rastreado do mesmo jeito que `friendships` já é. Por isso o
 * apagar aqui é físico (a linha some junto com o blob), não uma lápide para o sync propagar.
 *
 * `snapshot` é cópia, não join, de propósito: o site descreve a história como ela estava
 * naquela versão. Se o autor renomear a história amanhã, a versão publicada continua
 * anunciando o nome com que foi publicada.
 */
export const storyPublications = table(
  'story_publications',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    /** Dono no momento da publicação. Cópia de `stories.userId`, para o site não depender de join. */
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    /** Nome da versão, no estilo que o dono escolheu (ver `buildPublicationLabel`). */
    label: text('label').notNull(),
    /** `stories.lastOperationVersion` no instante da publicação. */
    operationVersion: integer('operation_version').notNull(),
    /** `CURRENT_STORY_FORMAT_VERSION` no instante da publicação. */
    formatVersion: integer('format_version').notNull(),
    /** `bigint` porque um pacote com galeria passa folgado de 2 GB no limite teórico. */
    byteSize: bigintNumber('byte_size').notNull(),
    mediaIncluded: integer('media_included').notNull().default(0),
    mediaTotal: integer('media_total').notNull().default(0),
    snapshot: json('snapshot').$type<StoryPublicationSnapshot>().notNull(),
    createdAt: timestampNow('created_at'),
  },
  (table) => [
    unique('story_publication_label_unq').on(table.storyId, table.label),
    index('story_publication_story_idx').on(table.storyId),
  ],
);

export const storyPublicationsRelations = relations(storyPublications, ({ one }) => ({
  story: one(stories, {
    fields: [storyPublications.storyId],
    references: [stories.id],
  }),
  owner: one(users, {
    fields: [storyPublications.ownerUserId],
    references: [users.id],
  }),
}));
