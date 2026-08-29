import { z } from 'zod';
import { BOARD_LOCAL_ID_ALPHABET, BOARD_LOCAL_ID_LENGTH } from './BoardSchemas';

/**
 * A Location Map is a named drawing over gallery images: pins of existing locations (with a
 * pickable icon) placed on top of image bases. It follows the Board's data shape - the drawing
 * travels as one JSON document (`images` + `nodes`), and the conflict unit is last-write-wins on
 * the whole `content`. The map's connections are NOT part of this JSON: they are the story's real
 * `connected_to` relations (`locationRelations`), rendered over the map but owned by the relation
 * manager.
 */

export const LOCATION_MAP_LOCAL_ID_LENGTH = BOARD_LOCAL_ID_LENGTH;
export const LOCATION_MAP_LOCAL_ID_ALPHABET = BOARD_LOCAL_ID_ALPHABET;
export const LOCATION_MAP_LOCAL_ID_REGEX = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export const MAX_LOCATION_MAP_IMAGES = 200;
export const MAX_LOCATION_MAP_NODES = 500;

/** Default icon color of a map point - the Location entity's own colour. */
export const DEFAULT_LOCATION_MAP_NODE_COLOR = '#8BC34A';

const LocationMapLocalIdSchema = z
  .string()
  .regex(LOCATION_MAP_LOCAL_ID_REGEX, 'Location map image and node ids are 8 Crockford characters');

export function generateLocationMapLocalId(existing: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    let id = '';
    for (let index = 0; index < LOCATION_MAP_LOCAL_ID_LENGTH; index += 1) {
      const pick = Math.floor(Math.random() * LOCATION_MAP_LOCAL_ID_ALPHABET.length);
      id += LOCATION_MAP_LOCAL_ID_ALPHABET[pick];
    }
    if (!existing.has(id)) return id;
  }
  throw new Error('Could not allocate a unique location map local id.');
}

const LocationMapImageSchema = z.object({
  id: LocationMapLocalIdSchema,
  /** The gallery medium used as the map's base drawing. */
  galleryId: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  /** When locked, touching/dragging the image moves the whole canvas instead of the image. */
  locked: z.boolean().default(false),
});

const LocationMapNodeSchema = z.object({
  id: LocationMapLocalIdSchema,
  /** The location this point represents. A location can appear on several maps. */
  locationId: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  /** An Ionicons glyph name (see `metadata/mapIcons.ts`). */
  icon: z.string().min(1).max(60),
  /** Color of the icon on the map, as a hex string. Defaults so older maps without it keep parsing. */
  color: z.string().max(20).default(DEFAULT_LOCATION_MAP_NODE_COLOR),
});

export const LocationMapContentSchema = z
  .object({
    images: z.array(LocationMapImageSchema).max(MAX_LOCATION_MAP_IMAGES),
    nodes: z.array(LocationMapNodeSchema).max(MAX_LOCATION_MAP_NODES),
  })
  .superRefine((content, context) => {
    const imageIds = new Set<string>();
    for (const [index, image] of content.images.entries()) {
      if (imageIds.has(image.id)) {
        context.addIssue({
          code: 'custom',
          path: ['images', index, 'id'],
          message: 'Duplicate image id on this location map.',
        });
      }
      imageIds.add(image.id);
    }

    const nodeIds = new Set<string>();
    for (const [index, node] of content.nodes.entries()) {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'id'],
          message: 'Duplicate node id on this location map.',
        });
      }
      nodeIds.add(node.id);
    }
  });

export const EMPTY_LOCATION_MAP_CONTENT = { images: [], nodes: [] } as const;

export const LocationMapSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  content: LocationMapContentSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateLocationMapDataSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().default(null),
  content: LocationMapContentSchema.default({ images: [], nodes: [] }),
});

export const PartialLocationMapSchema = CreateLocationMapDataSchema.partial();

export type LocationMapImageType = z.infer<typeof LocationMapImageSchema>;
export type LocationMapNodeType = z.infer<typeof LocationMapNodeSchema>;
export type LocationMapContentType = z.infer<typeof LocationMapContentSchema>;
export type LocationMapRowType = z.infer<typeof LocationMapSchema>;
export type CreateLocationMapDataType = z.infer<typeof CreateLocationMapDataSchema>;
export type PartialLocationMapType = z.infer<typeof PartialLocationMapSchema>;

/**
 * Rewrites `galleryId`/`locationId` after a story clone/import. Image and node ids stay: they are
 * local to this JSON, not rows in the id map.
 */
export function remapLocationMapContent(
  content: LocationMapContentType,
  remapId: (id: string) => string,
): LocationMapContentType {
  return {
    images: content.images.map((image) => ({ ...image, galleryId: remapId(image.galleryId) })),
    nodes: content.nodes.map((node) => ({ ...node, locationId: remapId(node.locationId) })),
  };
}
