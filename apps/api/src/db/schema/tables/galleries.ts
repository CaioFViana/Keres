import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { stories } from './stories';

/**
 * Uma mídia da história. Os bytes ficam em `media_blobs`, endereçados pelo `hash`; esta
 * tabela guarda só os metadados, que sincronizam pelo log de operações como qualquer
 * outra entidade.
 */
export const galleries = pgTable(
  'galleries',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    mediaType: text('media_type').notNull(), // 'image' | 'video' | 'audio'
    mimeType: text('mime_type').notNull(),
    fileName: text('file_name').notNull(),
    /** Checksum do conteúdo; liga esta linha ao blob correspondente. */
    hash: text('hash').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    title: text('title'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    extraNotes: text('extra_notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    // A rota de download confere se a história de fato referencia o hash pedido antes de
    // servir o arquivo; sem este índice essa checagem varreria a tabela a cada request.
    index('galleries_story_hash_idx').on(table.storyId, table.hash),
  ],
);

/**
 * Vínculo N:N entre uma mídia e uma entidade da história (`Character`, `Location`,
 * `Note`, `Scene` ou `Item`). O dono é polimórfico, então não há foreign key: a
 * existência do dono é validada no handler de sincronização, como em `tag_relations`.
 */
export const galleryRelations = pgTable(
  'gallery_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    galleryId: text('gallery_id')
      .notNull()
      .references(() => galleries.id),
    ownerId: text('owner_id').notNull(),
    ownerType: text('owner_type').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('gallery_relations_owner_idx').on(table.storyId, table.ownerType, table.ownerId),
    index('gallery_relations_gallery_idx').on(table.galleryId),
  ],
);

/**
 * Os bytes de uma mídia, endereçados pelo conteúdo.
 *
 * Global de propósito: dois usuários que subam a mesma imagem compartilham uma linha e um
 * arquivo. Isso não vaza nada, porque a autorização não acontece aqui - a rota de
 * download só serve um hash depois de confirmar que a história pedida tem permissão de
 * leitura *e* referencia aquele hash em `galleries`.
 */
export const mediaBlobs = pgTable(
  'media_blobs',
  {
    hash: text('hash').primaryKey(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** Caminho relativo à raiz de armazenamento configurada. */
    storagePath: text('storage_path').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('media_blobs_storage_path_idx').on(table.storagePath)],
);

export const galleriesRelations = relations(galleries, ({ one, many }) => ({
  story: one(stories, {
    fields: [galleries.storyId],
    references: [stories.id],
  }),
  owners: many(galleryRelations),
}));

export const galleryRelationsRelations = relations(galleryRelations, ({ one }) => ({
  story: one(stories, {
    fields: [galleryRelations.storyId],
    references: [stories.id],
  }),
  gallery: one(galleries, {
    fields: [galleryRelations.galleryId],
    references: [galleries.id],
  }),
}));
