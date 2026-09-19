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
 */
export function useScreenTour(screenId: string): void {
  const showTutorials = useUserSettingsStore((state) => state.showTutorials);
  const seen = useUserSettingsStore((state) => state.tutorialProgress.seen);
  const hasActiveTour = useGuideStore((state) => state.activeTour !== null);
  const startTour = useGuideStore((state) => state.startTour);

  useFocusEffect(
    useCallback(() => {
      const guide = getScreenGuide(screenId);
      if (!guide) return;
      if (
        shouldStartTour({
          showTutorials,
          seen,
          guideId: guide.id,
          hasActiveTour,
          isShowcase: readShowcaseRequest() !== null,
        })
      ) {
        startTour(guide);
      }
    }, [screenId, showTutorials, seen, hasActiveTour, startTour]),
  );
}
