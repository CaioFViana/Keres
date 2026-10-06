import { z } from 'zod';
import { ManuscriptStyleSchema } from './manuscriptStyle';

/** Manuscript renditions the pipeline produces - every one in pure TypeScript, on any host. */
export const ManuscriptFormatSchema = z.enum([
  'docx',
  'md',
  'txt',
  'html',
  'pdf',
  'epub',
  // A screenplay: the script as Fountain text, or paged as the industry sets it (Courier, indents).
  'fountain',
  'screenplay-pdf',
]);
export type ManuscriptFormat = z.infer<typeof ManuscriptFormatSchema>;

/** Largest manuscript the pipeline emits: anything bigger must be split first. */
export const MAX_MANUSCRIPT_BYTES = 50 * 1024 * 1024;

/** What a published version records about its manuscript rendition. */
export const ManuscriptInfoSchema = z.object({
  format: ManuscriptFormatSchema,
  byteSize: z.number().int(),
});
export type ManuscriptInfo = z.infer<typeof ManuscriptInfoSchema>;

/** What a published version records about its online reader page. */
export const ReaderInfoSchema = z.object({ byteSize: z.number().int() });
export type ReaderInfo = z.infer<typeof ReaderInfoSchema>;

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
  fountain: { extension: 'fountain', mimeType: 'text/plain' },
  'screenplay-pdf': { extension: 'pdf', mimeType: 'application/pdf' },
};

const labelSchema = z.string().max(80);

/** Localizable strings the renderers interpolate. Each is a short fragment, capped at 80 chars. */
export const ManuscriptLabelsSchema = z.object({
  goToPage: labelSchema,
  goToScene: labelSchema,
  looseHeading: labelSchema,
  tocHeading: labelSchema,
  /** Said after a gamebook choice whose target is not part of the export (an arc's edge). */
  endOfExcerpt: labelSchema,
  /** A gamebook with several starts opens on this: the invitation to pick one. */
  chooseStart: labelSchema,
  /** ...and each start is offered as this, followed by its scene. */
  beginAt: labelSchema,
});
export type ManuscriptLabels = z.infer<typeof ManuscriptLabelsSchema>;

/** English defaults, matching the client's `export_manuscript_*` strings. */
export const DEFAULT_MANUSCRIPT_LABELS: ManuscriptLabels = {
  goToPage: 'Go to page',
  goToScene: 'See',
  looseHeading: 'Appendix',
  tocHeading: 'Contents',
  endOfExcerpt: 'end of this excerpt',
  chooseStart: 'Choose where to begin',
  beginAt: 'Begin',
};

/** What only a screenplay needs: the paper it is paged on and what its title page and headings say. */
export const ScreenplayOptionsSchema = z.object({
  /** Letter or A4: the page count depends on it, so it is always stated. */
  paper: z.enum(['letter', 'a4']).default('letter'),
  /** `#1#`, `#2#`... on every scene heading, printed in both margins. */
  numberScenes: z.boolean().default(false),
  /** Writes `INT. PLACE` from a scene's location when its text has no heading of its own. */
  generateHeadings: z.boolean().default(true),
  /** One `=` synopsis per scene from its summary (Fountain only; never printed). */
  includeSynopses: z.boolean().default(true),
  /** One `#` section per chapter (Fountain only; never printed). */
  includeSections: z.boolean().default(true),
  /** Title page lines. All optional; the title and author come from the work and the options. */
  credit: z.string().max(120).optional(),
  source: z.string().max(200).optional(),
  draftDate: z.string().max(60).optional(),
  contact: z.string().max(400).optional(),
});
export type ScreenplayOptions = z.infer<typeof ScreenplayOptionsSchema>;

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
  /**
   * Branching stories only: how the gamebook numbers its scenes - as the reader meets them
   * (`discovery`) or scattered like a printed one (`shuffled`, start always 1).
   */
  sceneOrder: z.enum(['discovery', 'shuffled']).default('discovery'),
  /** Seed of the shuffled order; the same seed prints the same book. */
  shuffleSeed: z.string().max(64).optional(),
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
  /** Only for the `fountain` and `screenplay-pdf` formats. */
  screenplay: ScreenplayOptionsSchema.optional(),
});
export type ManuscriptOptions = z.infer<typeof ManuscriptOptionsSchema>;
export type ManuscriptOptionsInput = z.input<typeof ManuscriptOptionsSchema>;
