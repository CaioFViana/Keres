import { useCallback, useState } from 'react';
import { useDrizzle } from '@/src/db';
import { SYNC_ACCOUNT_NOTICE_ID, shouldShowSyncNotice } from '@/src/guides/shouldShowSyncNotice';
import { readShowcaseRequest } from '@/src/services/showcase/showcaseRequest';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { isServerless } from '@/src/utils/platform/clientFlavor';
import { fireAndLog } from '@/src/utils/logging/fireAndLog';

/**
 * The one-time bar telling a device with no account that synchronization and collaboration need one.
 * It stays in the story list until the person answers it - the button that goes to Server management
 * or "not now" - and either answer is the end of it: it is recorded in the seen history, so it does not
 * come back. "Reset tutorials" in Settings brings it back.
 *
 * `serverCount` is `null` until the screen has read its servers.
 */
export function useSyncAccountNotice(serverCount: number | null): {
  visible: boolean;
  dismiss: () => void;
} {
  const drizzleDb = useDrizzle();
  const showTutorials = useUserSettingsStore((state) => state.showTutorials);
  const seen = useUserSettingsStore((state) => state.tutorialProgress.seen);
  const markTutorialSeen = useUserSettingsStore((state) => state.markTutorialSeen);
  // The write lags behind the tap: this hides the bar at once instead of when the record lands.
  const [dismissed, setDismissed] = useState(false);

  const visible =
    !dismissed &&
    shouldShowSyncNotice({
      serverless: isServerless(),
      serverCount,
      seen,
      showTutorials,
      isShowcase: readShowcaseRequest() !== null,
    });

  const dismiss = useCallback(() => {
    setDismissed(true);
    fireAndLog(markTutorialSeen(drizzleDb, SYNC_ACCOUNT_NOTICE_ID), 'markSyncNoticeSeen');
  }, [drizzleDb, markTutorialSeen]);

  return { visible, dismiss };
}
