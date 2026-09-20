import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import {
  buildManuscriptFileName,
  deliverFile,
  type ExportDeliveryResult,
} from '../../../../utils/storyTransfer';
import { decodeBase64ToBytes } from './manuscriptBase64';
import type { CompiledManuscript } from './manuscriptCompiler';
import { buildManuscriptDocxBase64 } from './manuscriptDocx';
import { buildManuscriptHtml, printManuscriptPdf } from './manuscriptHtml';
import { buildManuscriptMarkdown, buildManuscriptText } from './manuscriptText';

export type ManuscriptExportFormat = 'docx' | 'pdf' | 'md' | 'txt';

export const MANUSCRIPT_EXPORT_FORMATS: ManuscriptExportFormat[] =
  Platform.OS === 'web' ? ['docx', 'md', 'txt'] : ['docx', 'pdf', 'md', 'txt'];

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
};

/**
 * Builds the manuscript in the requested format and hands it to the share sheet
 * (or a browser download on web). PDF prints to a temp file first and is re-read as
 * bytes so every format travels the same delivery path with the same file naming.
 */
export async function exportManuscript({
  storyTitle,
  manuscript,
  format,
  labels,
}: {
  storyTitle: string;
  manuscript: CompiledManuscript;
  format: ManuscriptExportFormat;
  labels: ManuscriptExportLabels;
}): Promise<ExportDeliveryResult> {
  const file = FORMAT_FILES[format];
  const fileName = buildManuscriptFileName(storyTitle, file.extension);
  if (format === 'docx') {
    const base64 = await buildManuscriptDocxBase64(manuscript, labels);
    return deliverFile(decodeBase64ToBytes(base64), fileName, file.mimeType, file.uti);
  }
  if (format === 'pdf') {
    const { uri } = await printManuscriptPdf(buildManuscriptHtml(manuscript, labels));
    const bytes = await new File(uri).bytes();
    return deliverFile(bytes, fileName, file.mimeType, file.uti);
  }
  const text =
    format === 'md'
      ? buildManuscriptMarkdown(manuscript, labels)
      : buildManuscriptText(manuscript, labels);
  return deliverFile(text, fileName, file.mimeType, file.uti);
}
