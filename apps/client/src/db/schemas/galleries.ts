import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Uma mídia da história.
 *
 * As colunas dividem-se em duas naturezas. As primeiras descrevem a mídia e sincronizam
 * com o servidor como qualquer outra entidade. As últimas (`localPath`, `uploadState`,
 * `downloadState`) descrevem o estado *deste aparelho* e nunca são enviadas: elas não
 * existem no `GallerySchema` compartilhado, e o zod do servidor descarta chaves
 * desconhecidas, então mesmo indo junto no payload elas param na borda.
 */
export const galleries = sqliteTable('galleries', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  mediaType: text('media_type').notNull(), // 'image' | 'video' | 'audio'
  mimeType: text('mime_type').notNull(),
  fileName: text('file_name').notNull(),
  /** Checksum do conteúdo; é por ele que o arquivo é localizado aqui e no servidor. */
  hash: text('hash').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  title: text('title'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),

  // --- Estado local, não sincronizado ---

  /** `file://` do arquivo neste aparelho. Nulo enquanto a mídia veio do servidor e ainda não baixou. */
  localPath: text('local_path'),
  /** 'pending' | 'uploaded' | 'failed' — se os bytes já chegaram ao servidor. */
  uploadState: text('upload_state').notNull().default('pending'),
  /** 'pending' | 'downloaded' | 'failed' — se os bytes já chegaram a este aparelho. */
  downloadState: text('download_state').notNull().default('downloaded'),
  /**
   * Frame extraído de um vídeo, para mostrar em grades/tiras sem montar um player por
   * célula. Só se aplica a `mediaType: 'video'`; imagem usa o próprio arquivo e áudio não
   * tem um quadro para extrair.
   */
  thumbnailPath: text('thumbnail_path'),
});

export type GalleryInsert = InferInsertModel<typeof galleries>;
export type GallerySelect = InferSelectModel<typeof galleries>;

export type MediaTransferState = 'pending' | 'uploaded' | 'downloaded' | 'failed';
