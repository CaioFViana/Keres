import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { readShowcaseRequest } from '../showcase/showcaseRequest';
import { useGuideStore } from '../state/guideStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { getScreenGuide } from './registry';
import { shouldStartTour } from './shouldStartTour';

/**
 * Opens the screen's tour on first focus: master switch on, tour unseen, nothing already
 * playing, and never in showcase captures. Screens without a registered guide are unaffected.
 * Screens whose tour explains editing chrome pass `enabled` (viewers keep quiet).
 */
export function useScreenTour(screenId: string, enabled = true): void {
  const showTutorials = useUserSettingsStore((state) => state.showTutorials);
  const seen = useUserSettingsStore((state) => state.tutorialProgress.seen);
  const hasActiveTour = useGuideStore((state) => state.activeTour !== null);
  const dismissedGuideIds = useGuideStore((state) => state.dismissedGuideIds);
  const snoozedGuideId = useGuideStore((state) => state.snoozedGuideId);
  const startTour = useGuideStore((state) => state.startTour);

  useFocusEffect(
    useCallback(() => {
      const guide = getScreenGuide(screenId);
      if (!guide || !enabled) return;
      if (
        shouldStartTour({
          showTutorials,
          seen,
          dismissedGuideIds,
          snoozedGuideId,
          guideId: guide.id,
          hasActiveTour,
          isShowcase: readShowcaseRequest() !== null,
        })
      ) {
        startTour(guide);
      }
    }, [
      screenId,
      enabled,
      showTutorials,
      seen,
      dismissedGuideIds,
      snoozedGuideId,
      hasActiveTour,
      startTour,
    ]),
  );

  // A snoozed tour ("later") stays hidden while this focus lasts; leaving the screen lifts
  // the snooze so the tour opens on the next visit. A stable callback keeps this cleanup
  // blur-only: store updates must not lift the snooze behind the effect above.
  useFocusEffect(
    useCallback(() => {
      return () => {
        useGuideStore.getState().clearSnooze();
      };
    }, []),
  );
}
