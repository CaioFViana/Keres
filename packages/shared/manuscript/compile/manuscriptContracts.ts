import { z } from 'zod';

/** Manuscript renditions the pipeline produces. PDF stays client-only (expo-print). */
export const ManuscriptFormatSchema = z.enum(['docx', 'md', 'txt', 'html']);
export type ManuscriptFormat = z.infer<typeof ManuscriptFormatSchema>;

/** Largest manuscript the pipeline emits: anything bigger must be split first. */
export const MAX_MANUSCRIPT_BYTES = 15 * 1024 * 1024;

/** What a published version records about its manuscript rendition. */
export const ManuscriptInfoSchema = z.object({
  format: ManuscriptFormatSchema,
  byteSize: z.number().int(),
});
export type ManuscriptInfo = z.infer<typeof ManuscriptInfoSchema>;

export const FORMAT_META: Record<ManuscriptFormat, { extension: string; mimeType: string }> = {
  docx: {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  md: { extension: 'md', mimeType: 'text/markdown' },
  txt: { extension: 'txt', mimeType: 'text/plain' },
  html: { extension: 'html', mimeType: 'text/html' },
};

const labelSchema = z.string().max(80);

/** Localizable strings the renderers interpolate. Each is a short fragment, capped at 80 chars. */
export const ManuscriptLabelsSchema = z.object({
  goToPage: labelSchema,
  goToScene: labelSchema,
  looseHeading: labelSchema,
});
export type ManuscriptLabels = z.infer<typeof ManuscriptLabelsSchema>;

/** English defaults, matching the client's `export_manuscript_*` strings. */
export const DEFAULT_MANUSCRIPT_LABELS: ManuscriptLabels = {
  goToPage: 'Go to page',
  goToScene: 'See',
  looseHeading: 'Loose scenes',
};

export const ManuscriptOptionsSchema = z.object({
  format: ManuscriptFormatSchema,
  includeLooseScenes: z.boolean().default(true),
  /** When set, the manuscript follows this route instead of the linear order. */
  routeId: z.string().optional(),
  /** Label overrides; anything absent falls back to `DEFAULT_MANUSCRIPT_LABELS`. */
  labels: ManuscriptLabelsSchema.partial().optional(),
});
export type ManuscriptOptions = z.infer<typeof ManuscriptOptionsSchema>;
export type ManuscriptOptionsInput = z.input<typeof ManuscriptOptionsSchema>;
