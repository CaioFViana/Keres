import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { createStoryService } from '../services/storymanagement/StoryService';
import { useNotificationStore } from '../state/notificationStore';
import { buildStoryZipBytes } from '../utils/storyMediaBundle';
import {
  buildExportFileName,
  buildExportZipFileName,
  deliverStoryExport,
  deliverStoryZipExport,
} from '../utils/storyTransfer';

/**
 * The whole story as a file to keep: the data alone (`.json`), or with the media this device already has
 * (`.zip`). What comes back to the app through Import, on this device or another.
 */
export function useStoryBackupExport(story: { id: string; title: string } | null | undefined) {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [exporting, setExporting] = useState(false);

  const exportJson = useCallback(async () => {
    if (!story) return;
    setExporting(true);
    try {
      const storyExport = await createStoryService(drizzleDb).exportFullStory(story.id);
      const result = await deliverStoryExport(storyExport, buildExportFileName(story.title));
      if (result.delivered) {
        showNotification(t('export_story_success', { fileName: result.fileName }), 'success');
      } else {
        // With no share sheet the file exists but cannot be reached; saying where it is beats claiming success.
        showNotification(
          t('export_story_no_share_target', { path: result.uri || result.fileName }),
          'warning',
        );
      }
    } catch (exportError) {
      console.log(`useStoryBackupExport: failed to export story ${story.id}.`, exportError);
      showNotification(t('export_story_failed'), 'error');
    } finally {
      setExporting(false);
    }
  }, [drizzleDb, showNotification, story, t]);

  const exportZip = useCallback(async () => {
    if (!story) return;
    setExporting(true);
    try {
      const storyExport = await createStoryService(drizzleDb).exportFullStory(story.id);
      const { bytes, includedCount, totalCount } = await buildStoryZipBytes(storyExport, story.id);
      const result = await deliverStoryZipExport(bytes, buildExportZipFileName(story.title));

      if (!result.delivered) {
        showNotification(
          t('export_story_no_share_target', { path: result.uri || result.fileName }),
          'warning',
        );
      } else if (totalCount > 0 && includedCount < totalCount) {
        // Media this device has not downloaded cannot go in; the .zip is incomplete and the person has to know.
        showNotification(
          t('export_story_zip_success_partial', {
            fileName: result.fileName,
            included: includedCount,
            total: totalCount,
          }),
          'warning',
        );
      } else {
        showNotification(t('export_story_success', { fileName: result.fileName }), 'success');
      }
    } catch (exportError) {
      console.log(`useStoryBackupExport: failed to export story ${story.id} as zip.`, exportError);
      showNotification(t('export_story_failed'), 'error');
    } finally {
      setExporting(false);
    }
  }, [drizzleDb, showNotification, story, t]);

  return { exporting, exportJson, exportZip };
}
