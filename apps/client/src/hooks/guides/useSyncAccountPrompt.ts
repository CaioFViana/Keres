import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '@/src/db';
import { getScreenGuide } from '@/src/guides/registry';
import { SYNC_ACCOUNT_PROMPT_ID, shouldShowSyncPrompt } from '@/src/guides/shouldShowSyncPrompt';
import { readShowcaseRequest } from '@/src/services/showcase/showcaseRequest';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { AppAlert } from '@/src/state/ui/AppAlert';
import { useGuideStore } from '@/src/state/ui/guideStore';
import { isServerless } from '@/src/utils/platform/clientFlavor';
import { fireAndLog } from '@/src/utils/logging/fireAndLog';

/**
 * Tells a device with no account, once, that synchronization and collaboration need one, and offers to
 * go to Server management (which leads on to the default server). Opens when the screen is in front,
 * after its own tour; it is marked as seen the moment it opens, so leaving it by any way - either
 * button, or tapping outside - is the end of it. "Reset tutorials" in Settings brings it back.
 *
 * `serverCount` is `null` until the screen has read its servers; `openServers` goes to Server management.
 */
export function useSyncAccountPrompt(serverCount: number | null, openServers: () => void): void {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const isFocused = useIsFocused();
  const showTutorials = useUserSettingsStore((state) => state.showTutorials);
  const seen = useUserSettingsStore((state) => state.tutorialProgress.seen);
  const markTutorialSeen = useUserSettingsStore((state) => state.markTutorialSeen);
  const hasActiveTour = useGuideStore((state) => state.activeTour !== null);
  // The write that records the notice lags behind opening it; this keeps a re-render from opening it twice.
  const opened = useRef(false);

  const tourGuide = getScreenGuide('StorySelectionMain');
  const tourPending = !!tourGuide && !seen.includes(tourGuide.id);

  useEffect(() => {
    if (!isFocused || opened.current) return;
    const show = shouldShowSyncPrompt({
      serverless: isServerless(),
      serverCount,
      seen,
      showTutorials,
      hasActiveTour,
      tourPending,
      isShowcase: readShowcaseRequest() !== null,
    });
    if (!show) return;
    opened.current = true;
    fireAndLog(markTutorialSeen(drizzleDb, SYNC_ACCOUNT_PROMPT_ID), 'markSyncPromptSeen');
    AppAlert.alert(t('sync_prompt_title'), t('sync_prompt_message'), [
      { text: t('sync_prompt_later'), style: 'cancel' },
      { text: t('sync_prompt_action'), onPress: openServers },
    ]);
  }, [
    isFocused,
    serverCount,
    seen,
    showTutorials,
    hasActiveTour,
    tourPending,
    markTutorialSeen,
    drizzleDb,
    openServers,
    t,
  ]);
}
