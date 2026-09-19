import { useCallback } from 'react';
import { useDrizzle } from '../db';
import { useUserSettingsStore } from '../state/userSettingsStore';

/**
 * Records finished or skipped tours. The write belongs here - a hook - because components
 * must not reach for the database (`importBoundaries` pins that); the database arriving by
 * hook keeps `GuideHost` a pure drawing component.
 *
 * The write runs in the background: a failed write only means the tour shows again, so the
 * UI never waits on persistence.
 */
export function useGuidePersistence(): (guideId: string) => void {
  const db = useDrizzle();
  const markTutorialSeen = useUserSettingsStore((state) => state.markTutorialSeen);
  return useCallback(
    (guideId: string) => {
      markTutorialSeen(db, guideId).catch((error: unknown) => {
        console.warn('[GuideHost] failed to record a seen tour; it will show again.', error);
      });
    },
    [db, markTutorialSeen],
  );
}
