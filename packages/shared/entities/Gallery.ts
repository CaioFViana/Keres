import type { MediaType } from '../schemas/GallerySchemas';

/**
 * Uma mídia da história (imagem, vídeo ou áudio).
 *
 * O arquivo é identificado pelo conteúdo (`hash`), e não pelo caminho: é isso que permite
 * a mesma mídia ser reaproveitada por várias entidades e detectar, na sincronização, se os
 * bytes mudaram. O caminho local do arquivo no aparelho é uma preocupação do cliente e não
 * faz parte desta interface.
 */
export interface Gallery {
  id: string;
  storyId: string;
  mediaType: MediaType;
  mimeType: string;
  fileName: string;
  /** Checksum do conteúdo em hex (ver `MediaHashSchema`). */
  hash: string;
  sizeBytes: number;
  title: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
