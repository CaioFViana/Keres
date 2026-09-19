interface ShouldStartTourInput {
  showTutorials: boolean;
  seen: readonly string[];
  dismissedGuideIds: readonly string[];
  guideId: string;
  hasActiveTour: boolean;
  isShowcase: boolean;
}

/**
 * Whether focusing a screen may open its tour. Pure so the rule stays unit-testable; the hook
 * (`useScreenTour`) only wires the inputs. The session record matters because the persisted
 * `seen` history lags behind the dismiss by one database write.
 */
export function shouldStartTour(input: ShouldStartTourInput): boolean {
  if (!input.showTutorials || input.isShowcase || input.hasActiveTour) return false;
  if (input.dismissedGuideIds.includes(input.guideId)) return false;
  return !input.seen.includes(input.guideId);
}
