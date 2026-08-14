import { z } from 'zod';

/**
 * Entidades que podem ter mídia acoplada.
 *
 * Vale como valor em runtime (a validação polimórfica do servidor percorre esta lista)
 * e como tipo, para que adicionar uma entidade aqui quebre a compilação nos lugares que
 * precisam de um `case` novo.
 */
export const GALLERY_OWNER_ENTITIES = ['Character', 'Location', 'Note', 'Scene', 'Item'] as const;
export type GalleryOwnerEntity = (typeof GALLERY_OWNER_ENTITIES)[number];

export const MEDIA_TYPES = ['image', 'video', 'audio'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/**
 * Formatos aceitos, restritos ao que o Expo/React Native consegue exibir ou tocar sem
 * transcodificação. Aceitar mais do que isto só produziria mídia que sobe, sincroniza e
 * depois não abre no aparelho.
 */
export const SUPPORTED_MEDIA_MIME_TYPES: Record<MediaType, readonly string[]> = {
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/heic',
    'image/heif',
  ],
  video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp'],
  audio: [
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/flac',
    'audio/3gpp',
  ],
} as const;

export const ALL_SUPPORTED_MEDIA_MIME_TYPES: readonly string[] = MEDIA_TYPES.flatMap(
  (type) => SUPPORTED_MEDIA_MIME_TYPES[type],
);

/** Filtro para o seletor de arquivos: `['image/*', 'video/*', 'audio/*']`. */
export const MEDIA_PICKER_MIME_FILTERS: readonly string[] = MEDIA_TYPES.map((type) => `${type}/*`);

/** Extensões usadas para nomear o arquivo local quando o mime type não traz uma. */
export const MEDIA_MIME_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
  'video/3gpp': '3gp',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/3gpp': '3gp',
};

export function isSupportedMediaMimeType(mimeType: string | null | undefined): boolean {
  return !!mimeType && ALL_SUPPORTED_MEDIA_MIME_TYPES.includes(mimeType.toLowerCase());
}

/** `'image/png' -> 'image'`. Devolve `null` para o que não é suportado. */
export function mediaTypeForMimeType(mimeType: string | null | undefined): MediaType | null {
  if (!mimeType) {
    return null;
  }
  const normalized = mimeType.toLowerCase();
  for (const type of MEDIA_TYPES) {
    if (SUPPORTED_MEDIA_MIME_TYPES[type].includes(normalized)) {
      return type;
    }
  }
  return null;
}

export function extensionForMimeType(mimeType: string | null | undefined): string {
  if (!mimeType) {
    return 'bin';
  }
  return MEDIA_MIME_TYPE_EXTENSIONS[mimeType.toLowerCase()] ?? 'bin';
}

/**
 * Hash do conteúdo do arquivo, em hexadecimal.
 *
 * É MD5 porque é o único digest que o `expo-file-system` calcula nativamente - fazer
 * SHA-256 em JS sobre um vídeo de dezenas de MB travaria a interface. Serve como
 * *checksum de conteúdo* (endereçamento e detecção de mudança), nunca como primitiva de
 * segurança: o servidor recalcula o hash dos bytes recebidos antes de aceitá-los, então
 * um cliente não consegue registrar um hash que não corresponde ao que enviou.
 */
export const MediaHashSchema = z
  .string()
  .regex(/^[a-f0-9]{32}$/, 'Media hash must be a 32-character lowercase hex digest');

/**
 * Uma mídia da história.
 *
 * Não tem dono: o vínculo com personagens, locais, notas, cenas e itens vive em
 * `GalleryRelation`, para que a mesma imagem possa ser usada por várias entidades sem ser
 * duplicada. O arquivo em si não trafega por aqui - estes campos descrevem os bytes
 * (`hash`, `sizeBytes`, `mimeType`) e o binário sobe/desce pelas rotas `/media`.
 */
export const GallerySchema = z.object({
  id: z.string(),
  storyId: z.string(),
  mediaType: z.enum(MEDIA_TYPES),
  mimeType: z.string().min(1),
  /** Nome original do arquivo, preservado só para exibição. */
  fileName: z.string().min(1),
  hash: MediaHashSchema,
  sizeBytes: z.number().int().min(0),
  title: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateGalleryDataSchema = GallerySchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  isFavorite: z.boolean().default(false),
  title: z.string().nullable().default(null),
  extraNotes: z.string().nullable().default(null),
});

export const PartialGallerySchema = GallerySchema.partial();

export type CreateGalleryDataType = z.infer<typeof CreateGalleryDataSchema>;
export type GalleryType = z.infer<typeof GallerySchema>;
export type PartialGalleryType = z.infer<typeof PartialGallerySchema>;

/**
 * Vínculo entre uma mídia e uma entidade da história.
 *
 * Mesma forma de `TagRelation`: uma linha por par, com tombstone, para que adicionar e
 * remover vínculos sincronize pelo mesmo caminho de qualquer outra entidade.
 */
export const GalleryRelationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  galleryId: z.string().min(1, 'Gallery ID cannot be empty'),
  ownerId: z.string().min(1, 'Owner ID cannot be empty'),
  ownerType: z.enum(GALLERY_OWNER_ENTITIES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateGalleryRelationDataSchema = GalleryRelationSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
});

export const PartialGalleryRelationSchema = GalleryRelationSchema.partial();

export type CreateGalleryRelationDataType = z.infer<typeof CreateGalleryRelationDataSchema>;
export type GalleryRelationType = z.infer<typeof GalleryRelationSchema>;
export type PartialGalleryRelationType = z.infer<typeof PartialGalleryRelationSchema>;

/** Corpo de `POST /media/:storyId/blobs/status`. */
export const MediaBlobStatusRequestSchema = z.object({
  hashes: z.array(MediaHashSchema).max(500),
});

export const MediaBlobStatusResponseSchema = z.object({
  present: z.array(z.string()),
  missing: z.array(z.string()),
});

export type MediaBlobStatusRequestType = z.infer<typeof MediaBlobStatusRequestSchema>;
export type MediaBlobStatusResponseType = z.infer<typeof MediaBlobStatusResponseSchema>;
