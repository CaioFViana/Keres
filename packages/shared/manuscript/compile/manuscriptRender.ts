import type { CompiledManuscript, ManuscriptRenderOptions } from './export/manuscriptCompiler';
import { buildManuscriptDocxBytes } from './export/manuscriptDocx';
import { buildManuscriptEpubBytes, type ManuscriptEpubMetadata } from './export/manuscriptEpub';
import { buildManuscriptHtml } from './export/manuscriptHtml';
import { buildManuscriptPdf, buildManuscriptPdfAsync } from './export/manuscriptPdf';
import type { PdfFontMatrices } from './export/manuscriptPdfFonts';
import { buildManuscriptMarkdown, buildManuscriptText } from './export/manuscriptText';
import type { ManuscriptFormat } from './manuscriptContracts';

export type ManuscriptRenderLabels = {
  goToPage: string;
  goToScene: string;
  tocHeading: string;
};

/**
 * One compiled manuscript in one format - the same code on the device (export) and on the server
 * (publish), so a file reads the same wherever it was made. Text formats come back as text, the
 * rest as bytes.
 */
export async function renderManuscript(
  manuscript: CompiledManuscript,
  format: ManuscriptFormat,
  labels: ManuscriptRenderLabels,
  options: ManuscriptRenderOptions = {},
  metadata: ManuscriptEpubMetadata = {},
  // Serif matrices for the PDF: when present the renderer embeds per-face
  // subsets (Unicode) instead of the WinAnsi base-14 Times. Bytes travel as a
  // parameter - never through the zod-validated options - injected by the
  // platform edge that owns the font files.
  pdfFonts?: PdfFontMatrices,
): Promise<Uint8Array | string> {
  switch (format) {
    case 'docx':
      return buildManuscriptDocxBytes(manuscript, labels, options);
    case 'pdf':
      if (pdfFonts) return buildManuscriptPdfAsync(manuscript, labels, options, pdfFonts);
      return buildManuscriptPdf(manuscript, labels, options);
    case 'epub':
      return buildManuscriptEpubBytes(manuscript, labels, options, metadata);
    case 'html':
      return buildManuscriptHtml(manuscript, labels, options);
    case 'md':
      return buildManuscriptMarkdown(manuscript, labels, options);
    case 'txt':
      return buildManuscriptText(manuscript, labels);
  }
}
