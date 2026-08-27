import { z } from 'zod';

/**
 * Entities that can have media attached.
 *
 * It works as a runtime value (the server's polymorphic validation walks this list) and as a type,
 * so that adding an entity here breaks compilation everywhere a new `case` is needed.
 */
export const GALLERY_OWNER_ENTITIES = ['Character', 'Location', 'Note', 'Scene', 'Item'] as const;
export type GalleryOwnerEntity = (typeof GALLERY_OWNER_ENTITIES)[number];

/** Image/video/audio play inside Keres. Documents and links are catalogued and opened outside. */
export const PLAYABLE_MEDIA_TYPES = ['image', 'video', 'audio'] as const;
export type PlayableMediaType = (typeof PLAYABLE_MEDIA_TYPES)[number];

export const MEDIA_TYPES = [...PLAYABLE_MEDIA_TYPES, 'document', 'link'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export function isPlayableMediaType(type: string | null | undefined): type is PlayableMediaType {
  return type === 'image' || type === 'video' || type === 'audio';
}

export function galleryHasFile(type: string | null | undefined): boolean {
  return type !== 'link';
}

/**
 * Accepted formats. Playable types are restricted to what Expo can display without transcoding.
 * Documents are stored as files and handed to the OS; links have no bytes.
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
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'text/rtf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/html',
    'application/epub+zip',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/json',
  ],
  link: ['text/uri-list'],
} as const;

export const ALL_SUPPORTED_MEDIA_MIME_TYPES: readonly string[] = MEDIA_TYPES.flatMap(
  (type) => SUPPORTED_MEDIA_MIME_TYPES[type],
);

/** Filtro para o seletor de ficheiros reproduzíveis: `['image/*', 'video/*', 'audio/*']`. */
export const MEDIA_PICKER_MIME_FILTERS: readonly string[] = PLAYABLE_MEDIA_TYPES.map(
  (type) => `${type}/*`,
);

export const DOCUMENT_PICKER_MIME_FILTERS: readonly string[] = [
  ...SUPPORTED_MEDIA_MIME_TYPES.document,
];

/** Extensions used to name the local file when the mime type does not bring one. */
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
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'text/html': 'html',
  'application/epub+zip': 'epub',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'pptx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/json': 'json',
  'text/uri-list': 'url',
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

/** `'image/png' -> 'image'`. Returns `null` for anything unsupported. */
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
 * An http(s) URL Keres will store and open outside the app. Anything else is rejected so a
 * `javascript:` bookmark cannot hide in the gallery.
 */
export function normalizeGalleryLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Hash of the file's content, in hexadecimal.
 *
 * It is MD5 because that is the only digest `expo-file-system` computes natively - doing SHA-256 in
 * JS over a video of tens of MB would freeze the interface. It serves as a *content checksum*
 * (addressing and change detection), never as a security primitive: the server recomputes the hash
 * of the bytes it receives before accepting them, so a client cannot register a hash that does not
 * match what it uploaded.
 */
export const MediaHashSchema = z
  .string()
  .regex(/^[a-f0-9]{32}$/, 'Media hash must be a 32-character lowercase hex digest');

/**
 * A media file belonging to the story.
 *
 * It has no owner: the link to characters, locations, notes, scenes and items lives in
 * `GalleryRelation`, so the same image can be used by several entities without being duplicated.
 * The file itself does not travel through here - these fields describe the bytes (`hash`,
 * `sizeBytes`, `mimeType`) and the binary goes up and down through the `/media` routes.
 */
export const GallerySchema = z.object({
  id: z.string(),
  storyId: z.string(),
  mediaType: z.enum(MEDIA_TYPES),
  mimeType: z.string().min(1),
  /** The file's original name, preserved for display only. */
  fileName: z.string().min(1),
  hash: MediaHashSchema,
  sizeBytes: z.number().int().min(0),
  /**
   * An external URL, only for `mediaType: 'link'`. Keres stores it and opens it outside the app;
   * it never fetches or embeds the page.
   */
  sourceUrl: z.string().url().nullable().optional(),
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
  sourceUrl: z.string().url().nullable().default(null),
});

export const PartialGallerySchema = CreateGalleryDataSchema.partial();

export type CreateGalleryDataType = z.infer<typeof CreateGalleryDataSchema>;
export type GalleryType = z.infer<typeof GallerySchema>;
export type PartialGalleryType = z.infer<typeof PartialGallerySchema>;

/**
 * A link between a media file and an entity of the story.
 *
 * The same shape as `TagRelation`: one row per pair, with a tombstone, so adding and removing links
 * synchronizes through the same path as any other entity.
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

export const PartialGalleryRelationSchema = CreateGalleryRelationDataSchema.partial();

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
