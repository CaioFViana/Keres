interface ShouldStartTourInput {
  showTutorials: boolean;
  seen: readonly string[];
  guideId: string;
  hasActiveTour: boolean;
  isShowcase: boolean;
}

/**
 * Whether focusing a screen may open its tour. Pure so the rule stays unit-testable; the hook
 * (`useScreenTour`) only wires the inputs.
 */
export function shouldStartTour(input: ShouldStartTourInput): boolean {
  if (!input.showTutorials || input.isShowcase || input.hasActiveTour) return false;
  return !input.seen.includes(input.guideId);
}
