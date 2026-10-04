import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { isOfflineError } from '../services/apiClient';
import { createServerService } from '../services/ServerService';
import { storyReportApi } from '../services/StoryReportApiService';
import { useNotificationStore } from '../state/notificationStore';
import { useStoryStore } from '../state/storyStore';

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

/**
 * Reporting the open story to the administrators of the server it is linked to. Local-only
 * stories have no administrators to write to, so there is nothing to report through.
 */
export function useStoryReport(storyId: string | undefined) {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { showNotification } = useNotificationStore();
  const [sending, setSending] = useState(false);

  const report = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!storyId || !selectedStory?.serverId) return false;
      const server = await createServerService(drizzleDb).getServerById(selectedStory.serverId);
      if (!server) {
        showNotification(t('report_no_server'), 'error');
        return false;
      }
      setSending(true);
      try {
        await storyReportApi.report(server, storyId, reason);
        showNotification(t('report_story_sent'), 'success');
        return true;
      } catch (error) {
        if (isOfflineError(error)) {
          showNotification(t('server_unreachable'), 'error');
        } else if (statusOf(error) === 429) {
          showNotification(t('message_limit_reached'), 'error');
        } else if (statusOf(error) === 403) {
          showNotification(t('report_story_forbidden'), 'error');
        } else {
          console.error('Failed to report story:', error);
          showNotification(t('report_story_failed'), 'error');
        }
        return false;
      } finally {
        setSending(false);
      }
    },
    [storyId, selectedStory?.serverId, drizzleDb, showNotification, t],
  );

  return {
    /** False for local-only stories: no server, no administrators, no report. */
    canReport: !!storyId && !!selectedStory?.serverId,
    sending,
    report,
  };
}
