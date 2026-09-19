/** @jest-environment node */
import type { Guide } from '../../src/guides/types';
import { useGuideStore } from '../../src/state/guideStore';

const guide = (id: string, stepCount: number): Guide => ({
  id,
  drawerId: 'story-selection',
  steps: Array.from({ length: stepCount }, (_, index) => ({
    id: `step-${index}`,
    titleKey: `title-${index}`,
    bodyKey: `body-${index}`,
  })),
});

const store = () => useGuideStore.getState();

beforeEach(() => {
  useGuideStore.setState({ activeTour: null, dismissedGuideIds: [] });
});

describe('startTour', () => {
  it('opens the guide on its first step', () => {
    store().startTour(guide('Tour', 3));

    expect(store().activeTour).toMatchObject({ guide: { id: 'Tour' }, stepIndex: 0 });
  });

  it('ignores guides with no steps', () => {
    store().startTour(guide('Empty', 0));

    expect(store().activeTour).toBeNull();
  });

  it('replaces the playing tour', () => {
    store().startTour(guide('First', 2));

    store().startTour(guide('Second', 2));

    expect(store().activeTour).toMatchObject({ guide: { id: 'Second' }, stepIndex: 0 });
  });

  it('keeps the step when the same tour starts twice', () => {
    store().startTour(guide('Tour', 3));
    store().nextStep();

    store().startTour(guide('Tour', 3));

    expect(store().activeTour).toMatchObject({ guide: { id: 'Tour' }, stepIndex: 1 });
  });
});

describe('nextStep / prevStep', () => {
  it('walks forward and back without leaving the guide', () => {
    store().startTour(guide('Tour', 3));

    store().nextStep();
    store().nextStep();
    expect(store().activeTour?.stepIndex).toBe(2);

    store().prevStep();
    expect(store().activeTour?.stepIndex).toBe(1);
  });

  it('clamps at both ends instead of dismissing', () => {
    store().startTour(guide('Tour', 2));

    store().prevStep();
    expect(store().activeTour?.stepIndex).toBe(0);

    store().nextStep();
    store().nextStep();
    expect(store().activeTour?.stepIndex).toBe(1);
    expect(store().activeTour).not.toBeNull();
  });

  it('does nothing without an active tour', () => {
    store().nextStep();
    store().prevStep();

    expect(store().activeTour).toBeNull();
  });
});

describe('skipTour / completeTour', () => {
  it.each(['skipTour', 'completeTour'] as const)('%s dismisses from any step', (action) => {
    store().startTour(guide('Tour', 3));
    store().nextStep();

    store()[action]();

    expect(store().activeTour).toBeNull();
  });

  it.each(['skipTour', 'completeTour'] as const)('%s records the session dismissal', (action) => {
    store().startTour(guide('Tour', 3));

    store()[action]();

    expect(store().dismissedGuideIds).toEqual(['Tour']);
  });
});

describe('undismissGuide / reset', () => {
  it('undismissGuide drops one id so a failed write can show again', () => {
    store().startTour(guide('Tour', 1));
    store().skipTour();

    store().undismissGuide('Tour');

    expect(store().dismissedGuideIds).toEqual([]);
  });

  it('reset clears the active tour and the session record', () => {
    store().startTour(guide('Tour', 3));
    store().skipTour();

    store().reset();

    expect(store().activeTour).toBeNull();
    expect(store().dismissedGuideIds).toEqual([]);
  });
});
