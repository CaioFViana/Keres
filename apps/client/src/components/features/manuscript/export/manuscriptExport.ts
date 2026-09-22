import type { CompiledManuscript, ManuscriptRenderOptions } from '@keres/shared';
import {
  buildManuscriptDocxBytes,
  buildManuscriptHtml,
  buildManuscriptMarkdown,
  buildManuscriptPdf,
  buildManuscriptText,
} from '@keres/shared';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import {
  buildManuscriptFileName,
  deliverFile,
  type ExportDeliveryResult,
} from '../../../../utils/storyTransfer';

export type ManuscriptExportFormat = 'docx' | 'pdf' | 'md' | 'txt';

/** Every platform offers every format: on web, PDF is drawn in pure TypeScript. */
export const MANUSCRIPT_EXPORT_FORMATS: ManuscriptExportFormat[] = ['docx', 'pdf', 'md', 'txt'];

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
  md: { extension: 'md', mimeType: 'text/markdown', uti: 'public.plain-text' },
  txt: { extension: 'txt', mimeType: 'text/plain', uti: 'public.plain-text' },
};

export type ManuscriptExportLabels = {
  goToPage: string;
  goToScene: string;
  tocHeading: string;
};

/**
 * Builds the manuscript in the requested format and hands it to the share sheet
 * (or a browser download on web). Native PDF prints to a temp file first and is
 * re-read as bytes so it travels the same delivery path; web PDF has no print
 * pipeline, so the pure-TypeScript renderer draws real PDF bytes instead.
 */
export async function exportManuscript({
  storyTitle,
  manuscript,
  format,
  labels,
  options = {},
}: {
  storyTitle: string;
  manuscript: CompiledManuscript;
  format: ManuscriptExportFormat;
  labels: ManuscriptExportLabels;
  options?: ManuscriptRenderOptions;
}): Promise<ExportDeliveryResult> {
  const file = FORMAT_FILES[format];
  const fileName = buildManuscriptFileName(storyTitle, file.extension);
  if (format === 'docx') {
    const bytes = await buildManuscriptDocxBytes(manuscript, labels, options);
    return deliverFile(bytes, fileName, file.mimeType, file.uti);
  }
  if (format === 'pdf') {
    if (Platform.OS === 'web') {
      const bytes = await buildManuscriptPdf(manuscript, labels, options);
      return deliverFile(bytes, fileName, file.mimeType, file.uti);
    }
    const { uri } = await Print.printToFileAsync({
      html: buildManuscriptHtml(manuscript, labels, options),
    });
    const bytes = await new File(uri).bytes();
    return deliverFile(bytes, fileName, file.mimeType, file.uti);
  }
  const text =
    format === 'md'
      ? buildManuscriptMarkdown(manuscript, labels, options)
      : buildManuscriptText(manuscript, labels);
  return deliverFile(text, fileName, file.mimeType, file.uti);
}
