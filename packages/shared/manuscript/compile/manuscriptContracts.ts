import { z } from 'zod';
import { ManuscriptStyleSchema } from './manuscriptStyle';

/** Manuscript renditions the pipeline produces - every one in pure TypeScript, on any host. */
export const ManuscriptFormatSchema = z.enum(['docx', 'md', 'txt', 'html', 'pdf', 'epub']);
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
  pdf: { extension: 'pdf', mimeType: 'application/pdf' },
  epub: { extension: 'epub', mimeType: 'application/epub+zip' },
};

const labelSchema = z.string().max(80);

/** Localizable strings the renderers interpolate. Each is a short fragment, capped at 80 chars. */
export const ManuscriptLabelsSchema = z.object({
  goToPage: labelSchema,
  goToScene: labelSchema,
  looseHeading: labelSchema,
  tocHeading: labelSchema,
});
export type ManuscriptLabels = z.infer<typeof ManuscriptLabelsSchema>;

/** English defaults, matching the client's `export_manuscript_*` strings. */
export const DEFAULT_MANUSCRIPT_LABELS: ManuscriptLabels = {
  goToPage: 'Go to page',
  goToScene: 'See',
  looseHeading: 'Appendix',
  tocHeading: 'Contents',
};

/** Every default is the device export's own, so a publication and a local file agree. */
export const ManuscriptOptionsSchema = z.object({
  format: ManuscriptFormatSchema,
  includeLooseScenes: z.boolean().default(false),
  /** Scene headings; off also drops choice references (they would name a scene). */
  includeSceneNames: z.boolean().default(false),
  /** Clickable index after the title block. */
  includeToc: z.boolean().default(false),
  /** Scene numbers restart in every chapter (linear stories). */
  resetSceneNumbers: z.boolean().default(false),
  /** Typography and presentation (`manuscriptStyle.ts`); absent is the long-standing look. */
  style: ManuscriptStyleSchema.optional(),
  /** When set, the manuscript follows this route instead of the linear order. */
  routeId: z.string().optional(),
  /** When set, only this arc's containers and scenes are included. */
  arcId: z.string().optional(),
  /** Label overrides; anything absent falls back to `DEFAULT_MANUSCRIPT_LABELS`. */
  labels: ManuscriptLabelsSchema.partial().optional(),
  /** Book metadata (EPUB): the author, `Story.author` by default at the caller. */
  author: z.string().max(200).nullable().optional(),
  /** Book metadata (EPUB): a unique identifier; derived from the title when absent. */
  identifier: z.string().max(200).optional(),
  /** Book metadata (EPUB): BCP 47 language of the text, e.g. `pt-BR`. */
  language: z.string().max(35).optional(),
});
export type ManuscriptOptions = z.infer<typeof ManuscriptOptionsSchema>;
export type ManuscriptOptionsInput = z.input<typeof ManuscriptOptionsSchema>;
