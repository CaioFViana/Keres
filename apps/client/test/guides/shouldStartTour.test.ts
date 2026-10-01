/** @jest-environment node */
import { shouldStartTour } from '../../src/guides/shouldStartTour';

const base = {
  showTutorials: true,
  seen: [] as string[],
  dismissedGuideIds: [] as string[],
  snoozedGuideId: null as string | null,
  guideId: 'StorySelectionMain',
  hasActiveTour: false,
  isShowcase: false,
};

describe('shouldStartTour', () => {
  it('opens an unseen tour when the switch is on', () => {
    expect(shouldStartTour(base)).toBe(true);
  });

  it('stays quiet once the tour was seen', () => {
    expect(shouldStartTour({ ...base, seen: ['StorySelectionMain'] })).toBe(false);
  });

  it('stays quiet when the master switch is off', () => {
    expect(shouldStartTour({ ...base, showTutorials: false })).toBe(false);
  });

  it('never interrupts a playing tour', () => {
    expect(shouldStartTour({ ...base, hasActiveTour: true })).toBe(false);
  });

  it('never shows in showcase captures', () => {
    expect(shouldStartTour({ ...base, isShowcase: true })).toBe(false);
  });

  it('stays quiet for tours dismissed this session, before persistence lands', () => {
    expect(shouldStartTour({ ...base, dismissedGuideIds: ['StorySelectionMain'] })).toBe(false);
  });

  it('stays quiet for the snoozed tour until the next focus', () => {
    expect(shouldStartTour({ ...base, snoozedGuideId: 'StorySelectionMain' })).toBe(false);
  });

  it('ignores a snooze set by another tour', () => {
    expect(shouldStartTour({ ...base, snoozedGuideId: 'OtherTour' })).toBe(true);
  });
});
