import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../state/notificationStore';
import { chooseExportFormat } from '../utils/exportFormatPrompt';
import {
  deliverMapExport,
  exportFileLanguage,
  type ExportFileLanguage,
} from '../utils/storyTransfer';

type Options = {
  /** The story whose title names the file; nothing is exported while it is missing. */
  story: { title: string } | null | undefined;
  /** False when the map has nothing to draw, which makes the export a no-op. */
  hasNodes: boolean;
  renderSvg(title: string): string;
  buildFileName(title: string, now: Date, language: ExportFileLanguage): string;
  messageKeys: { success: string; noShareTarget: string; failed: string };
  /** The console line written when rendering or delivering the file fails. */
  logMessage: string;
};

/**
 * Exports a graph map as an image: chooses the format, renders the SVG, delivers the file and
 * reports the outcome. Returns the busy flag the map controls show while it runs.
 */
export function useGraphMapExport({
  story,
  hasNodes,
  renderSvg,
  buildFileName,
  messageKeys,
  logMessage,
}: Options) {
  const { t, i18n } = useTranslation();
  const { showNotification } = useNotificationStore();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!story || !hasNodes) return;

    const format = await chooseExportFormat();
    if (!format) return;
    setExporting(true);
    try {
      const svg = renderSvg(story.title);
      const result = await deliverMapExport(
        svg,
        buildFileName(story.title, new Date(), exportFileLanguage(i18n.language)),
        format,
      );
      if (result.delivered) {
        showNotification(t(messageKeys.success, { fileName: result.fileName }), 'success');
      } else {
        // With no share sheet the file exists, but the user has no way to reach it; saying where
        // it is is more useful than claiming success.
        showNotification(
          t(messageKeys.noShareTarget, { path: result.uri || result.fileName }),
          'warning',
        );
      }
    } catch (exportError) {
      console.log(logMessage, exportError);
      showNotification(t(messageKeys.failed), 'error');
    } finally {
      setExporting(false);
    }
  };

  return { exporting, handleExport };
}
