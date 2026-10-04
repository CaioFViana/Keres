import {
  DEFAULT_MANUSCRIPT_LABELS,
  FORMAT_META,
  MAX_MANUSCRIPT_BYTES,
  ManuscriptOptionsSchema,
  type ManuscriptOptionsInput,
} from './manuscriptContracts';
import { renderManuscript } from './manuscriptRender';
import { renderOptionsOf } from './manuscriptStyle';
import { presentedManuscriptOf, type CompileStoryManuscriptInput } from './presentedManuscript';
import type { PdfFontMatrices } from './export/manuscriptPdfFonts';

export type CompiledStoryManuscript = {
  bytes: Uint8Array;
  extension: string;
  mimeType: string;
};

/**
 * Compiles a story's manuscript and renders it to bytes. Throws past `MAX_MANUSCRIPT_BYTES`.
 */
export async function compileStoryManuscript(
  input: CompileStoryManuscriptInput,
  options: ManuscriptOptionsInput,
  pdfFonts?: PdfFontMatrices,
): Promise<CompiledStoryManuscript> {
  const parsed = ManuscriptOptionsSchema.parse(options);
  const labels = { ...DEFAULT_MANUSCRIPT_LABELS, ...parsed.labels };
  const presented = presentedManuscriptOf(input, parsed, labels);
  const rendered = await renderManuscript(
    presented,
    parsed.format,
    labels,
    renderOptionsOf(parsed.style, parsed.includeToc),
    {
      author: parsed.author,
      identifier: parsed.identifier,
      language: parsed.language,
      modified: new Date(),
    },
    pdfFonts,
  );
  const bytes = typeof rendered === 'string' ? new TextEncoder().encode(rendered) : rendered;
  if (bytes.length > MAX_MANUSCRIPT_BYTES) {
    throw new Error(
      `Manuscript exceeds the ${MAX_MANUSCRIPT_BYTES}-byte limit (${bytes.length} bytes).`,
    );
  }
  const meta = FORMAT_META[parsed.format];
  return { bytes, extension: meta.extension, mimeType: meta.mimeType };
}
