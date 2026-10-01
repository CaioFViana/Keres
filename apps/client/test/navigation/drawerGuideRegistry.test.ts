/** @jest-environment node */
import type { GuideDrawerHandle } from '../../src/navigation/drawerGuideRegistry';
import {
  __resetGuideDrawersForTests,
  getGuideDrawer,
  registerGuideDrawer,
  scrollDrawerToRect,
  unregisterGuideDrawer,
} from '../../src/navigation/drawerGuideRegistry';

const handle = (overrides: Partial<GuideDrawerHandle> = {}): GuideDrawerHandle => ({
  navigation: {} as never,
  scrollTo: jest.fn(),
  getScrollOffset: () => 100,
  measureScrollWindowY: async () => 50,
  ...overrides,
});

beforeEach(() => {
  __resetGuideDrawersForTests();
});

describe('drawer registry', () => {
  it('hands out the registered drawer and forgets it on unmount', () => {
    const registered = handle();
    registerGuideDrawer('main-system', registered);

    expect(getGuideDrawer('main-system')).toBe(registered);
    expect(getGuideDrawer('story-selection')).toBeUndefined();

    unregisterGuideDrawer('main-system');
    expect(getGuideDrawer('main-system')).toBeUndefined();
  });
});

describe('scrollDrawerToRect', () => {
  it('lands the rect below the drawer top by the margin', async () => {
    const scrollTo = jest.fn();
    registerGuideDrawer('main-system', handle({ scrollTo }));

    await scrollDrawerToRect('main-system', { x: 0, y: 400, width: 200, height: 120 }, 96);

    // offset 100 + (rect 400 - scroll view 50) - margin 96
    expect(scrollTo).toHaveBeenCalledWith(354);
  });

  it('clamps to the top instead of overscrolling', async () => {
    const scrollTo = jest.fn();
    registerGuideDrawer(
      'main-system',
      handle({ scrollTo, getScrollOffset: () => 0, measureScrollWindowY: async () => 500 }),
    );

    await scrollDrawerToRect('main-system', { x: 0, y: 100, width: 200, height: 120 }, 96);

    expect(scrollTo).toHaveBeenCalledWith(0);
  });

  it('does nothing without a handle or a measurement', async () => {
    await scrollDrawerToRect('main-system', { x: 0, y: 400, width: 200, height: 120 }, 96);

    const scrollTo = jest.fn();
    registerGuideDrawer(
      'main-system',
      handle({ scrollTo, measureScrollWindowY: async () => null }),
    );
    await scrollDrawerToRect('main-system', { x: 0, y: 400, width: 200, height: 120 }, 96);

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
