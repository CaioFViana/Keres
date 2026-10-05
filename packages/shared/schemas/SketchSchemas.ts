import { z } from 'zod';
import { isSpatialEnvelopeSafe } from '../graphs/spatialCanvas';
import {
  CanvasOverlaySchema,
  canvasOverlayBounds,
  MAX_CANVAS_OVERLAYS,
} from './CanvasOverlaySchemas';

/**
 * A Sketch is a quick freehand drawing over a page: vector strokes, shapes, stamps,
 * speech balloons and short texts — a base to continue elsewhere (e.g. Krita), not a
 * painting program. Unlike a Board it pins no story entities and draws no graph edges;
 * the whole drawing travels as one JSON document, so last-write-wins on `content` as a
 * whole is the conflict unit, exactly like boards.
 */

/** Crockford (ULID alphabet), 8 chars — shared with boards/maps so ids stay uniform. */
export const SKETCH_LOCAL_ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SKETCH_LOCAL_ID_LENGTH = 8;
export const SKETCH_LOCAL_ID_REGEX = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export const MAX_SKETCH_LAYERS = 20;
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

const SketchPageSchema = z.object({
  width: z.number().finite().min(96).max(8000),
  height: z.number().finite().min(96).max(8000),
  /** Which preset the size came from; null for a custom size. */
  preset: z.string().max(24).nullable().optional(),
});

const SketchLayerSchema = z.object({
  id: SketchLocalIdSchema,
  name: z.string().min(1).max(MAX_SKETCH_LAYER_NAME_LENGTH),
  visible: z.boolean().default(true),
  /** 0 (transparent) to 1 (opaque); honored by the canvas and the export. */
  opacity: z.number().finite().min(0).max(1).default(1),
});

export const EMPTY_SKETCH_PAGE = { width: 794, height: 1123, preset: 'a4' } as const;

export const SketchContentSchema = z
  .object({
    page: SketchPageSchema.default({ ...EMPTY_SKETCH_PAGE }),
    layers: z.array(SketchLayerSchema).max(MAX_SKETCH_LAYERS).default([]),
    overlays: z.array(CanvasOverlaySchema).max(MAX_CANVAS_OVERLAYS).default([]),
  })
  .superRefine((content, context) => {
    const layerIds = new Set<string>();
    for (const [index, layer] of content.layers.entries()) {
      if (layerIds.has(layer.id)) {
        context.addIssue({
          code: 'custom',
          path: ['layers', index, 'id'],
          message: 'Duplicate layer id on this sketch.',
        });
      }
      layerIds.add(layer.id);
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
      if (overlay.layerId !== undefined && !layerIds.has(overlay.layerId)) {
        context.addIssue({
          code: 'custom',
          path: ['overlays', index, 'layerId'],
          message: 'Overlay refers to a layer that is not on this sketch.',
        });
      }
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

export const SketchSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1).max(MAX_SKETCH_TITLE_LENGTH),
  description: z.string().max(MAX_SKETCH_DESCRIPTION_LENGTH).nullable(),
  content: SketchContentSchema,
  /** Gallery snapshot of this sketch (see the canvas "save to gallery"); null while none. */
  coverGalleryId: z.string().min(1).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateSketchDataSchema = z.object({
  name: z.string().min(1).max(MAX_SKETCH_TITLE_LENGTH),
  description: z.string().max(MAX_SKETCH_DESCRIPTION_LENGTH).nullable().default(null),
  content: SketchContentSchema.default({
    page: { ...EMPTY_SKETCH_PAGE },
    layers: [],
    overlays: [],
  }),
  coverGalleryId: z.string().min(1).nullable().default(null),
});

export const PartialSketchSchema = CreateSketchDataSchema.partial();

export type SketchContentType = z.output<typeof SketchContentSchema>;
export type SketchLayerType = z.output<typeof SketchLayerSchema>;
export type SketchPageType = z.output<typeof SketchPageSchema>;
export type SketchRowType = z.infer<typeof SketchSchema>;
export type CreateSketchDataType = z.infer<typeof CreateSketchDataSchema>;
export type PartialSketchType = z.infer<typeof PartialSketchSchema>;

/**
 * Rewrites `coverGalleryId` after a story clone/import. Overlay and layer ids stay:
 * they are local to this JSON, not rows in the id map. An unmapped gallery (a snapshot
 * the pack does not carry) clears the cover instead of pointing at a stranger's row.
 */
export function remapSketchContent(
  content: z.infer<typeof SketchContentSchema>,
): z.infer<typeof SketchContentSchema> {
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
