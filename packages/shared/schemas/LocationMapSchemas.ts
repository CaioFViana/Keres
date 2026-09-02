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
export const MAX_LOCATION_MAP_MARKERS = 500;
export const MAX_LOCATION_MAP_RELATION_TEXTS = 1000;
export const MAX_LOCATION_MAP_MARKER_CONNECTIONS = 1000;

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
  /** Stacking order among image bases. Images always remain below map relations and nodes. */
  zIndex: z.number().finite().optional(),
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
  /** Stacking order among location points. */
  zIndex: z.number().finite().optional(),
  /** Optional cartographic destination; this is not a LocationRelation. */
  destinationMapId: z.string().min(1).nullable().optional(),
  /** Snapshot used to keep a deleted Location point legible. */
  labelAtPin: z.string().max(200).optional(),
});

/** A map-only point such as loot, a door, a danger zone or a free annotation. */
export const LocationMapMarkerSchema = z.object({
  id: LocationMapLocalIdSchema,
  x: z.number().finite(),
  y: z.number().finite(),
  title: z.string().min(1).max(200),
  note: z.string().max(8000).nullable().optional(),
  icon: z.string().min(1).max(60),
  color: z.string().max(20).default(DEFAULT_LOCATION_MAP_NODE_COLOR),
  zIndex: z.number().finite().optional(),
  destinationMapId: z.string().min(1).nullable().optional(),
});

/** Map-local label for a relation. It never changes the story's shared Location relation itself. */
export const LocationMapRelationTextSchema = z.object({
  sourceLocationId: z.string().min(1),
  destinationLocationId: z.string().min(1),
  text: z.string().min(1).max(500),
});

/** A map-only edge when at least one end is a free marker. Point ids are local to the map. */
export const LocationMapMarkerConnectionSchema = z.object({
  id: LocationMapLocalIdSchema,
  fromId: LocationMapLocalIdSchema,
  toId: LocationMapLocalIdSchema,
  directed: z.boolean().default(true),
  label: z.string().min(1).max(500).nullable().optional(),
});

export const LocationMapContentSchema = z
  .object({
    images: z.array(LocationMapImageSchema).max(MAX_LOCATION_MAP_IMAGES),
    nodes: z.array(LocationMapNodeSchema).max(MAX_LOCATION_MAP_NODES),
    markers: z.array(LocationMapMarkerSchema).max(MAX_LOCATION_MAP_MARKERS).optional(),
    relationTexts: z
      .array(LocationMapRelationTextSchema)
      .max(MAX_LOCATION_MAP_RELATION_TEXTS)
      .optional(),
    markerConnections: z
      .array(LocationMapMarkerConnectionSchema)
      .max(MAX_LOCATION_MAP_MARKER_CONNECTIONS)
      .optional(),
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
    const locationIds = new Set<string>();
    for (const [index, node] of content.nodes.entries()) {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'id'],
          message: 'Duplicate node id on this location map.',
        });
      }
      nodeIds.add(node.id);
      if (locationIds.has(node.locationId)) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'locationId'],
          message: 'A location can only appear once on the same map.',
        });
      }
      locationIds.add(node.locationId);
    }

    for (const [index, marker] of (content.markers ?? []).entries()) {
      if (nodeIds.has(marker.id)) {
        context.addIssue({
          code: 'custom',
          path: ['markers', index, 'id'],
          message: 'Duplicate node or marker id on this location map.',
        });
      }
      nodeIds.add(marker.id);
    }

    const relationTextKeys = new Set<string>();
    for (const [index, relationText] of (content.relationTexts ?? []).entries()) {
      const key = `${relationText.sourceLocationId}:${relationText.destinationLocationId}`;
      if (relationTextKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['relationTexts', index],
          message: 'Duplicate relation text on this location map.',
        });
      }
      relationTextKeys.add(key);
    }

    const markerConnectionIds = new Set<string>();
    for (const [index, connection] of (content.markerConnections ?? []).entries()) {
      if (markerConnectionIds.has(connection.id) || nodeIds.has(connection.id)) {
        context.addIssue({
          code: 'custom',
          path: ['markerConnections', index, 'id'],
          message: 'Duplicate marker connection id on this location map.',
        });
      }
      markerConnectionIds.add(connection.id);
      if (
        connection.fromId === connection.toId ||
        !nodeIds.has(connection.fromId) ||
        !nodeIds.has(connection.toId)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['markerConnections', index],
          message: 'A marker connection must join two different points on this location map.',
        });
      }
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
export type LocationMapMarkerType = z.infer<typeof LocationMapMarkerSchema>;
export type LocationMapRelationTextType = z.infer<typeof LocationMapRelationTextSchema>;
export type LocationMapMarkerConnectionType = z.infer<typeof LocationMapMarkerConnectionSchema>;
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
    nodes: content.nodes.map((node) => ({
      ...node,
      locationId: remapId(node.locationId),
      destinationMapId: node.destinationMapId
        ? remapId(node.destinationMapId)
        : node.destinationMapId,
    })),
    markers: content.markers?.map((marker) => ({
      ...marker,
      destinationMapId: marker.destinationMapId
        ? remapId(marker.destinationMapId)
        : marker.destinationMapId,
    })),
    relationTexts: content.relationTexts?.map((relationText) => ({
      ...relationText,
      sourceLocationId: remapId(relationText.sourceLocationId),
      destinationLocationId: remapId(relationText.destinationLocationId),
    })),
    markerConnections: content.markerConnections?.map((connection) => ({ ...connection })),
  };
}
