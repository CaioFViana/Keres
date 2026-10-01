import type {
  CompiledManuscript,
  ManuscriptEpubMetadata,
  ManuscriptFormat,
  ManuscriptRenderOptions,
  ManuscriptStyle,
} from '@keres/shared';
import { presentManuscript, renderManuscript, renderOptionsOf } from '@keres/shared';
import {
  buildManuscriptFileName,
  deliverFile,
  type ExportDeliveryResult,
  type ExportFileLanguage,
} from '../../../../utils/storyTransfer';

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
}): Promise<ExportDeliveryResult> {
  const file = FORMAT_FILES[format];
  const fileName = buildManuscriptFileName(storyTitle, file.extension, new Date(), language);
  const presented = presentManuscript(manuscript, style, language === 'pt' ? 'pt' : 'en');
  const rendered = await renderManuscript(
    presented,
    format,
    labels,
    { ...renderOptionsOf(style), ...options },
    { modified: new Date(), ...metadata },
  );
  return deliverFile(rendered, fileName, file.mimeType, file.uti);
}
