import { z } from 'zod';
import { isSpatialEnvelopeSafe } from '../graphs/spatialCanvas';
import { decodeSketchItems, SketchCodecError } from '../sketch/sketchCodec';
import { MAX_SKETCH_LAYER_DATA_LENGTH, MAX_SKETCH_TOTAL_DATA_LENGTH } from '../sketch/sketchTypes';
import {
  CanvasOverlaySchema,
  canvasOverlayBounds,
  MAX_CANVAS_OVERLAYS,
} from './CanvasOverlaySchemas';

/**
 * A Sketch is a quick drawing on a page: strokes, bucket fills, speech balloons, text and
 * stamps, to say "this is the plan" - and a base to continue in a real art program. Unlike a
 * Board it pins no story entities and draws no graph edges. The whole drawing travels as one
 * JSON document (last-write-wins on `content` as a whole is the conflict unit, exactly like
 * boards) and there is no raster in it: each layer's strokes and fills are one compact
 * encoded string (see `sketch/sketchCodec.ts`), so a busy page stays in the hundreds of KB.
 * The only PNG a sketch ever produces is an export the user asks for.
 */

/** Crockford (ULID alphabet), 8 chars — shared with boards/maps so ids stay uniform. */
export const SKETCH_LOCAL_ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SKETCH_LOCAL_ID_LENGTH = 8;
export const SKETCH_LOCAL_ID_REGEX = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export const MAX_SKETCH_LAYERS = 24;
/** Layer names. Mirrored by the layer sheet via `maxLength`. */
export const MAX_SKETCH_LAYER_NAME_LENGTH = 60;
/** Sketch titles and text-box contents are short by design. */
export const MAX_SKETCH_TITLE_LENGTH = 120;
export const MAX_SKETCH_DESCRIPTION_LENGTH = 500;

const SketchLocalIdSchema = z
  .string()
  .regex(SKETCH_LOCAL_ID_REGEX, 'Sketch layer ids are 8 Crockford characters');

export function generateSketchLocalId(existing: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    let id = '';
    for (let index = 0; index < SKETCH_LOCAL_ID_LENGTH; index += 1) {
      const pick = Math.floor(Math.random() * SKETCH_LOCAL_ID_ALPHABET.length);
      id += SKETCH_LOCAL_ID_ALPHABET[pick];
    }
    if (!existing.has(id)) return id;
  }
  throw new Error('Could not allocate a unique sketch-local id.');
}

/** Paper sizes in world units (96dpi pixels): a guide for the sketch, not print output. */
export const SKETCH_PAGE_PRESETS = [
  { id: 'a4', width: 794, height: 1123 },
  { id: 'a5', width: 559, height: 794 },
  { id: 'square', width: 1080, height: 1080 },
  { id: 'wide', width: 1280, height: 720 },
  { id: 'webtoon', width: 800, height: 1280 },
] as const;
export type SketchPagePresetId = (typeof SKETCH_PAGE_PRESETS)[number]['id'];

export const SKETCH_PAGE_BACKGROUNDS = ['paper', 'white', 'transparent'] as const;
export type SketchPageBackground = (typeof SKETCH_PAGE_BACKGROUNDS)[number];

const SketchPageSchema = z.object({
  width: z.number().finite().min(96).max(8000),
  height: z.number().finite().min(96).max(8000),
  /** Which preset the size came from; null for a custom size. */
  preset: z.string().max(24).nullable().optional(),
  /** `paper` follows the theme's paper tone; `transparent` exports a PNG with alpha. */
  background: z.enum(SKETCH_PAGE_BACKGROUNDS).default('paper'),
});

const SketchLayerSchema = z.object({
  id: SketchLocalIdSchema,
  name: z.string().min(1).max(MAX_SKETCH_LAYER_NAME_LENGTH),
  visible: z.boolean().default(true),
  /** 0 (transparent) to 1 (opaque); honored by the canvas and the export. */
  opacity: z.number().finite().min(0).max(1).default(1),
  /** A locked layer shows but takes no strokes, fills, erasing or selection. */
  locked: z.boolean().default(false),
  /** The layer's strokes and fills, encoded; '' for an empty layer. */
  data: z.string().max(MAX_SKETCH_LAYER_DATA_LENGTH).default(''),
});

export const EMPTY_SKETCH_PAGE = {
  width: 794,
  height: 1123,
  preset: 'a4',
  background: 'paper',
} as const;

export const SketchContentSchema = z
  .object({
    page: SketchPageSchema.default({ ...EMPTY_SKETCH_PAGE }),
    layers: z.array(SketchLayerSchema).min(1).max(MAX_SKETCH_LAYERS),
    /** Text, balloons, stamps and shapes: editable objects above every layer. */
    overlays: z.array(CanvasOverlaySchema).max(MAX_CANVAS_OVERLAYS).default([]),
  })
  .superRefine((content, context) => {
    const layerIds = new Set<string>();
    let totalLength = 0;
    for (const [index, layer] of content.layers.entries()) {
      if (layerIds.has(layer.id)) {
        context.addIssue({
          code: 'custom',
          path: ['layers', index, 'id'],
          message: 'Duplicate layer id on this sketch.',
        });
      }
      layerIds.add(layer.id);
      totalLength += layer.data.length;
      try {
        decodeSketchItems(layer.data);
      } catch (error) {
        context.addIssue({
          code: 'custom',
          path: ['layers', index, 'data'],
          message: error instanceof SketchCodecError ? error.message : 'Invalid layer data.',
        });
      }
    }
    if (totalLength > MAX_SKETCH_TOTAL_DATA_LENGTH) {
      context.addIssue({
        code: 'custom',
        path: ['layers'],
        message: 'This sketch is too large; simplify or split it.',
      });
    }
    const overlayIds = new Set<string>();
    for (const [index, overlay] of content.overlays.entries()) {
      if (overlayIds.has(overlay.id)) {
        context.addIssue({
          code: 'custom',
          path: ['overlays', index, 'id'],
          message: 'Duplicate overlay id on this sketch.',
        });
      }
      overlayIds.add(overlay.id);
    }
    // Overlays must stay inside a sane envelope even though the page bounds the
    // export: an unbounded coordinate would make geometry unsafe.
    if (
      !isSpatialEnvelopeSafe([
        { x: 0, y: 0, width: content.page.width, height: content.page.height },
        ...content.overlays.map(canvasOverlayBounds),
      ])
    ) {
      context.addIssue({
        code: 'custom',
        path: ['overlays'],
        message: 'Sketch overlays exceed the supported spatial canvas envelope.',
      });
    }
  });

/** The one runtime boundary for a Sketch's JSON document, shared by client and server. */
export function validateSketchContent(content: unknown) {
  return SketchContentSchema.parse(content);
}

/** A blank sketch: one empty layer on the given page. */
export function emptySketchContent(
  layerId: string,
  layerName: string,
  page: z.input<typeof SketchPageSchema> = { ...EMPTY_SKETCH_PAGE },
): SketchContentType {
  return {
    page: { ...EMPTY_SKETCH_PAGE, ...page, background: page.background ?? 'paper' },
    layers: [{ id: layerId, name: layerName, visible: true, opacity: 1, locked: false, data: '' }],
    overlays: [],
  };
}

export const SketchSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1).max(MAX_SKETCH_TITLE_LENGTH),
  description: z.string().max(MAX_SKETCH_DESCRIPTION_LENGTH).nullable(),
  content: SketchContentSchema,
  /** Gallery export of this sketch (see the canvas "save to gallery"); null while none. */
  coverGalleryId: z.string().min(1).nullable(),
  // Absent from rows and packages that predate it.
  coverSourceHash: z.string().min(1).max(64).nullable().default(null),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateSketchDataSchema = z.object({
  name: z.string().min(1).max(MAX_SKETCH_TITLE_LENGTH),
  description: z.string().max(MAX_SKETCH_DESCRIPTION_LENGTH).nullable().default(null),
  content: SketchContentSchema,
  coverGalleryId: z.string().min(1).nullable().default(null),
  coverSourceHash: z.string().min(1).max(64).nullable().default(null),
});

export const PartialSketchSchema = CreateSketchDataSchema.partial();

export type SketchContentType = z.output<typeof SketchContentSchema>;
export type SketchLayerType = z.output<typeof SketchLayerSchema>;
export type SketchPageType = z.output<typeof SketchPageSchema>;
export type SketchRowType = z.infer<typeof SketchSchema>;
export type CreateSketchDataType = z.infer<typeof CreateSketchDataSchema>;
export type PartialSketchType = z.infer<typeof PartialSketchSchema>;

/**
 * Rewrites the row-level `coverGalleryId` after a story clone/import. The drawing itself holds
 * no row references (layer and overlay ids are local to this JSON), so `content` is copied as is.
 * An unmapped gallery (an export the pack does not carry) clears the cover instead of pointing
 * at a stranger's row.
 */
export function remapSketchContent(content: SketchContentType): SketchContentType {
  return {
    page: { ...content.page },
    layers: content.layers.map((layer) => ({ ...layer })),
    overlays: content.overlays.map((overlay) => ({ ...overlay })),
  };
}

/** Remaps the row-level gallery reference; content ids are local and stay untouched. */
export function remapSketchCoverGalleryId(
  coverGalleryId: string | null,
  remapId: (id: string) => string | undefined,
): string | null {
  if (coverGalleryId === null) return null;
  return remapId(coverGalleryId) ?? null;
}
