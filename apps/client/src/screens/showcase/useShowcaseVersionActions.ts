import type { ShowcaseStoryDetail, ShowcaseVersion } from '@keres/shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import { useDrizzle } from '@/src/db';
import {
  showcaseApiService,
  showcaseSourceUrl,
  type ShowcaseSource,
} from '@/src/services/api/ShowcaseApiService';
import { importStoryZipBytes } from '@/src/services/storymanagement/story-lifecycle/StoryImportService';
import { createStoryService } from '@/src/services/storymanagement/story-lifecycle/StoryService';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { useStoryListStore } from '@/src/state/story/storyListStore';
import { AppAlert } from '@/src/state/ui/AppAlert';
import { useNotificationStore } from '@/src/state/ui/notificationStore';
import { buildStoryReaderUrl } from '@/src/utils/format/showcaseUrls';
import { deliverManuscriptBytes } from '@/src/components/features/manuscript/export/manuscriptExport';
import { StoryImportError, storyImportMessageKey } from '@/src/utils/io/StoryImportError';
import {
  buildExportZipFileName,
  deliverStoryZipExport,
  exportFileLanguage,
} from '@/src/utils/io/storyTransfer';
import { logger } from '@/src/utils/logging/logger';

export type ShowcaseVersionAction = 'read' | 'download' | 'manuscript' | 'import';

/** What is going on with a version right now: which one, doing what, and how far along when that is known. */
export interface BusyShowcaseVersion {
  versionId: string;
  action: ShowcaseVersionAction;
  progress: number | null;
}

interface Options {
  source: ShowcaseSource | null;
  story: ShowcaseStoryDetail;
  unlockToken: string | null;
}

/**
 * What the person can do with a version of a published story: read it online (the server's own reader, in the
 * browser), take its Keres package as a file, or import a copy of it as a story of their own. One at a time.
 */
export function useShowcaseVersionActions({ source, story, unlockToken }: Options) {
  const { t, i18n } = useTranslation();
  const db = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { fetchStories } = useStoryListStore();
  const [busy, setBusy] = useState<BusyShowcaseVersion | null>(null);

  const run = useCallback(
    async (
      version: ShowcaseVersion,
      action: ShowcaseVersionAction,
      work: (progress: (fraction: number) => void) => Promise<void>,
      failedKey: string,
    ) => {
      setBusy({ versionId: version.id, action, progress: null });
      try {
        await work((fraction) => setBusy({ versionId: version.id, action, progress: fraction }));
      } catch (error) {
        if (error instanceof StoryImportError) {
          logger.debug('useShowcaseVersionActions: package rejected.', error.message);
          showNotification(t(storyImportMessageKey(error.reason)), 'error');
        } else {
          logger.error(`useShowcaseVersionActions: ${action} failed.`, error);
          showNotification(t(failedKey), 'error');
        }
      } finally {
        setBusy(null);
      }
    },
    [showNotification, t],
  );

  const readOnline = useCallback(
    (version: ShowcaseVersion) => {
      if (!source) return Promise.resolve();
      return run(
        version,
        'read',
        async () => {
          // The site's own reader page for a story anybody can open. Behind a password, or adults-only, the page
          // would ask again (or refuse) in a browser that has neither: the reader is opened directly, by an
          // address that carries the permission for a minute.
          const direct = !!unlockToken || story.snapshot.isNsfw === true;
          const url = direct
            ? await showcaseApiService.getReaderUrl(source, story.storyId, version.id, unlockToken)
            : buildStoryReaderUrl(showcaseSourceUrl(source), story.storyId, version.id);
          await Linking.openURL(url);
        },
        'showcase_read_failed',
      );
    },
    [run, source, story, unlockToken],
  );

  const fetchPackage = useCallback(
    (version: ShowcaseVersion, progress: (fraction: number) => void) =>
      showcaseApiService.downloadPackage(source!, story.storyId, version.id, unlockToken, {
        onProgress: progress,
      }),
    [source, story.storyId, unlockToken],
  );

  const fileNameOf = useCallback(
    (version: ShowcaseVersion) =>
      buildExportZipFileName(`${story.snapshot.title} ${version.label}`),
    [story.snapshot.title],
  );

  const downloadPackage = useCallback(
    (version: ShowcaseVersion) => {
      if (!source) return Promise.resolve();
      return run(
        version,
        'download',
        async (progress) => {
          const bytes = await fetchPackage(version, progress);
          const delivery = await deliverStoryZipExport(bytes, fileNameOf(version));
          showNotification(
            t(delivery.delivered ? 'showcase_download_done' : 'showcase_download_no_share'),
            delivery.delivered ? 'success' : 'info',
          );
        },
        'showcase_download_failed',
      );
    },
    [run, source, fetchPackage, fileNameOf, showNotification, t],
  );

  const downloadManuscript = useCallback(
    (version: ShowcaseVersion) => {
      if (!source || !version.manuscript) return Promise.resolve();
      const { format } = version.manuscript;
      return run(
        version,
        'manuscript',
        async (progress) => {
          const bytes = await showcaseApiService.downloadManuscript(
            source,
            story.storyId,
            version.id,
            unlockToken,
            { onProgress: progress },
          );
          const delivery = await deliverManuscriptBytes({
            storyTitle: story.snapshot.title,
            bytes,
            format,
            language: exportFileLanguage(i18n.language),
          });
          showNotification(
            t(delivery.delivered ? 'showcase_download_done' : 'showcase_download_no_share'),
            delivery.delivered ? 'success' : 'info',
          );
        },
        'showcase_manuscript_failed',
      );
    },
    [run, source, story, unlockToken, i18n.language, showNotification, t],
  );

  const importCopy = useCallback(
    (version: ShowcaseVersion) => {
      if (!source) return;
      if (!userId) {
        showNotification(t('user_not_identified'), 'error');
        return;
      }
      AppAlert.alert(
        t('showcase_import_confirm_title'),
        t('showcase_import_confirm_message', {
          title: story.snapshot.title,
          version: version.label,
        }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('showcase_import'),
            onPress: () => {
              void run(
                version,
                'import',
                async (progress) => {
                  const bytes = await fetchPackage(version, progress);
                  const { title } = await importStoryZipBytes(
                    db,
                    userId,
                    bytes,
                    fileNameOf(version),
                  );
                  showNotification(t('import_story_success', { title }), 'success');
                  fetchStories(createStoryService(db)); // Keeps the story selection screen up to date.
                },
                'showcase_import_failed',
              );
            },
          },
        ],
      );
    },
    [
      source,
      userId,
      story.snapshot.title,
      run,
      fetchPackage,
      fileNameOf,
      db,
      fetchStories,
      showNotification,
      t,
    ],
  );

  return { busy, readOnline, downloadPackage, downloadManuscript, importCopy };
}
