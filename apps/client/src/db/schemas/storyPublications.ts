import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { servers } from './servers';

/**
 * Espelho local das versões públicas de uma história (Showcase).
 *
 * Fora do motor de sincronização, de propósito - como `friendships`: nada aqui entra no log de
 * operações nem tem handler de sync. A tabela existe por dois motivos, e só eles:
 *   1. a tela de publicação lista as versões sem precisar de rede a cada abertura;
 *   2. ela é a base de comparação que revela o que foi publicado enquanto este aparelho estava
 *      offline - o servidor avisa por WebSocket, mas o barramento dele é em memória e não
 *      reenvia nada, então o app refaz o GET a cada reconexão e compara com o que já tinha.
 */
export const storyPublications = sqliteTable(
  'story_publications',
  {
    /** O mesmo id do servidor - estas linhas nunca nascem locais. */
    id: text('id').primaryKey(),
    serverId: text('server_id')
      .notNull()
      .references(() => servers.id),
    storyId: text('story_id').notNull(),
    label: text('label').notNull(),
    operationVersion: integer('operation_version').notNull(),
    byteSize: integer('byte_size').notNull(),
    /** Instante da publicação no servidor, não de quando este aparelho ficou sabendo. */
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    /**
     * Falso enquanto a pessoa ainda não foi avisada. Sem isto, a primeira sincronização depois
     * de instalar o app dispararia um aviso para cada versão que já existia.
     */
    notified: integer('notified', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [unique('publication_server_unq').on(table.serverId, table.id)],
);

export type StoryPublicationInsert = InferInsertModel<typeof storyPublications>;
export type StoryPublicationSelect = InferSelectModel<typeof storyPublications>;
