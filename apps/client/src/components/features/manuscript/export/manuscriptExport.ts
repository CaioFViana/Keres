import type {
  CompiledManuscript,
  ManuscriptFormat,
  ManuscriptRenderOptions,
  ManuscriptStyle,
} from '@keres/shared';
import { presentManuscript, renderOptionsOf } from '@keres/shared';
import type { ManuscriptEpubMetadata } from '@keres/shared/manuscript/export';
import { renderManuscript } from '@keres/shared/manuscript/export';
import {
  buildManuscriptFileName,
  deliverFile,
  type ExportDeliveryResult,
  type ExportFileLanguage,
} from '../../../../utils/storyTransfer';
import { pdfFontMatrices } from './pdfFontAssets';

export type ManuscriptExportFormat = ManuscriptFormat;

/** Every platform offers every format: every renderer is pure TypeScript. */
export const MANUSCRIPT_EXPORT_FORMATS: ManuscriptExportFormat[] = [
  'docx',
  'pdf',
  'epub',
  'html',
  'md',
  'txt',
];

const FORMAT_FILES: Record<
  ManuscriptExportFormat,
  { extension: string; mimeType: string; uti: string }
> = {
  docx: {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    uti: 'org.openxmlformats.wordprocessingml.document',
  },
  pdf: { extension: 'pdf', mimeType: 'application/pdf', uti: 'com.adobe.pdf' },
  epub: {
    extension: 'epub',
    mimeType: 'application/epub+zip',
    uti: 'org.idpf.epub-container',
  },
  html: { extension: 'html', mimeType: 'text/html', uti: 'public.html' },
  md: { extension: 'md', mimeType: 'text/markdown', uti: 'public.plain-text' },
  txt: { extension: 'txt', mimeType: 'text/plain', uti: 'public.plain-text' },
};

export type ManuscriptExportLabels = {
  goToPage: string;
  goToScene: string;
  tocHeading: string;
};

/** TEMP-DIAG: FNV-1a for the corrupted-PDF investigation (removed after). */
function fnv1a(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i] ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Presents the manuscript as the style asks, draws it in the requested format and hands it to
 * the share sheet (or a browser download on web). The same presentation and renderers the
 * server uses to publish, so a file reads the same wherever it was made.
 */
export async function exportManuscript({
  storyTitle,
  manuscript,
  format,
  labels,
  options = {},
  style = {},
  metadata = {},
  language = 'en',
  cjkMatrix = null,
}: {
  storyTitle: string;
  manuscript: CompiledManuscript;
  format: ManuscriptExportFormat;
  labels: ManuscriptExportLabels;
  options?: ManuscriptRenderOptions;
  /** Typography and presentation (numbering, quotes, title page...). */
  style?: ManuscriptStyle;
  /** Book metadata for the EPUB (author, language...). */
  metadata?: ManuscriptEpubMetadata;
  /** App language for the file-name slug; never the system language. */
  language?: ExportFileLanguage;
  /**
   * CJK matrix for PDFs whose text needs the downloadable pack (loaded by the
   * caller after the prompt). Absent = CJK degrades to `?`, exactly like the
   * WinAnsi path always did.
   */
  cjkMatrix?: Uint8Array | null;
}): Promise<ExportDeliveryResult & { unicodePdf: boolean }> {
  const file = FORMAT_FILES[format];
  const fileName = buildManuscriptFileName(storyTitle, file.extension, new Date(), language);
  const presented = presentManuscript(manuscript, style, language === 'pt' ? 'pt' : 'en');
  // The serif matrices load only for PDFs (and fall back to Times when the
  // bundled asset is unavailable): every other format skips them entirely.
  // The CJK matrix joins them only when the caller resolved the pack.
  const base = format === 'pdf' ? await pdfFontMatrices() : null;
  const fonts =
    format === 'pdf' && base ? { ...base, ...(cjkMatrix ? { cjk: cjkMatrix } : {}) } : undefined;
  // TEMP-DIAG (corrupted-PDF investigation): fingerprint the exact bytes the
  // writer will subset, so a wrong-bit asset shows up in the console.
  if (format === 'pdf') {
    console.info(
      `[manuscript] pdf fonts: base=${base ? `${base.regular.length}/${fnv1a(base.regular)}+${base.italic.length}/${fnv1a(base.italic)}` : 'null'} cjk=${cjkMatrix ? `${cjkMatrix.length}/${fnv1a(cjkMatrix)}` : 'null'}`,
    );
  }
  const rendered = await renderManuscript(
    presented,
    format,
    labels,
    { ...renderOptionsOf(style), ...options },
    { modified: new Date(), ...metadata },
    fonts,
  );
  const delivery = await deliverFile(rendered, fileName, file.mimeType, file.uti);
  // Whether the PDF took the embedded-subset path. The caller needs it: a
  // CJK book on the legacy WinAnsi path exports every such char as `?`, and
  // that must warn instead of passing silent.
  return { ...delivery, unicodePdf: format === 'pdf' && !!fonts };
}
